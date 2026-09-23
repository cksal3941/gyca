import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CertificateDownloadSchema, CertificateIssueResultSchema, CertificateStageSchema,
  IssueCertificatesRequestSchema } from "../../contracts/certificates.ts";
import { CertificateSummarySchema, pageSchema } from "../../contracts/index.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { UploadStorage } from "../uploads/storage.ts";
import { CertificateSnapshotSchema } from "./pdf.ts";

const competitionIdSchema = z.string().min(1).max(128);
const latinDisplay = z.string().trim().min(1).max(1000).regex(/^[\x20-\x7e\u00a0-\u00ff]+$/);
const issueRowSchema = z.object({ id: z.uuid(), entry_id: z.uuid(), state: z.enum(["pending", "running", "issued", "stalled"]), issued_at: z.date().nullable() });

async function authorize(db: SqlConnection, actor: string) {
  if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
    throw new EntryFault("FORBIDDEN", 403);
}
async function issueResult(db: SqlConnection, batchId: string, stage: z.infer<typeof CertificateStageSchema>) {
  const rows = (await db.query(`SELECT c.id,c.entry_id,c.state,c.issued_at FROM gyca_certificate_issue_batch_items i
    JOIN gyca_certificates c ON c.id=i.certificate_id WHERE i.batch_id=$1 ORDER BY c.entry_id`, [batchId])).rows.map(row => issueRowSchema.parse(row));
  return CertificateIssueResultSchema.parse({ stage, requested: rows.length, items: rows.map(row => ({ id: row.id,
    entryId: row.entry_id, state: row.state === "running" ? "pending" : row.state, issuedAt: row.issued_at?.toISOString() ?? null })) });
}

export function createCertificateHandlers(deps: {
  readonly database: EntryDatabase; readonly storage: UploadStorage | null;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const list = (request: Request, entryId: string | null) => run(request, false, 200, async owner => {
    const params = new URL(request.url).searchParams;
    const cursor = parseRequest(z.uuid().nullable(), params.get("cursor"));
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    const entry = entryId === null ? null : parseRequest(z.uuid(), entryId);
    if (entry !== null && !(await deps.database.query("SELECT id FROM gyca_entries WHERE id=$1 AND owner_id=$2", [entry, owner])).rows.length)
      throw new EntryFault("NOT_FOUND", 404);
    const rows = await deps.database.query(`SELECT c.id,c.entry_id,c.stage,c.issued_at,c.snapshot
      FROM gyca_certificates c JOIN gyca_entries e ON e.id=c.entry_id
      WHERE e.owner_id=$1 AND c.state='issued' AND ($2::uuid IS NULL OR c.entry_id=$2)
        AND ($3::uuid IS NULL OR c.id>$3) ORDER BY c.id LIMIT $4`, [owner, entry, cursor, limit + 1]);
    const parsed = rows.rows.map(raw => z.object({ id: z.uuid(), entry_id: z.uuid(), stage: CertificateStageSchema,
      issued_at: z.date(), snapshot: CertificateSnapshotSchema }).parse(raw));
    const page = parsed.slice(0, limit);
    return pageSchema(CertificateSummarySchema).parse({ items: page.map(row => ({ id: row.id, entryId: row.entry_id,
      competitionTitle: row.snapshot.competitionTitle, workTitle: row.snapshot.workTitle, stage: row.stage,
      issuedAt: row.issued_at.toISOString(), allowedActions: ["download_certificate"] })),
      nextCursor: parsed.length > limit ? page.at(-1)?.id ?? null : null });
  });
  return {
    listMine: (request: Request) => list(request, null),
    listEntry: (request: Request, entryId: string) => list(request, entryId),
    download: (request: Request, certificateId: string) => run(request, true, 200, async owner => {
      parseRequest(z.strictObject({}), await jsonBody(request));
      const id = parseRequest(z.uuid(), certificateId);
      const raw = (await deps.database.query(`SELECT c.object_key,c.object_version,c.issued_at FROM gyca_certificates c
        JOIN gyca_entries e ON e.id=c.entry_id WHERE c.id=$1 AND e.owner_id=$2 AND c.state='issued'`, [id, owner])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ object_key: z.string(), object_version: z.string(), issued_at: z.date() }).parse(raw);
      if (!deps.storage?.signDownload) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      const signed = await deps.storage.signDownload({ key: row.object_key, version: row.object_version });
      return CertificateDownloadSchema.parse({ ...signed, issuedAt: row.issued_at.toISOString() });
    }),
    issue: (request: Request, competitionId: string) => run(request, true, 202, async actor => {
      const competition = parseRequest(competitionIdSchema, competitionId);
      const input = parseRequest(IssueCertificatesRequestSchema, await jsonBody(request));
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      return deps.database.transaction(async db => {
        await authorize(db, actor);
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
        const replayRaw = (await db.query(`SELECT id,request_hash,competition_id,stage FROM gyca_certificate_issue_batches
          WHERE actor_id=$1 AND action_id=$2`, [actor, input.actionId])).rows[0];
        if (replayRaw) {
          const replay = z.object({ id: z.uuid(), request_hash: z.string(), competition_id: z.string(), stage: CertificateStageSchema }).parse(replayRaw);
          if (replay.request_hash !== hash || replay.competition_id !== competition || replay.stage !== input.stage)
            throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return issueResult(db, replay.id, replay.stage);
        }
        const placeholders = input.entryIds.map((_, index) => `$${index + 3}`).join(",");
        const rows = (await db.query(`SELECT e.id,s.snapshot,c.public_content,p.result FROM gyca_entries e
          JOIN gyca_submissions s ON s.entry_id=e.id JOIN gyca_competitions c ON c.id=e.competition_id
          JOIN gyca_entry_result_round_publications p ON p.entry_id=e.id AND p.competition_id=e.competition_id AND p.round=$2
          WHERE e.competition_id=$1 AND e.id IN (${placeholders}) AND e.status='received' AND p.result=$2`,
        [competition, input.stage, ...input.entryIds])).rows;
        if (rows.length !== input.entryIds.length) throw new EntryFault("ENTRY_LOCKED", 409);
        const at = deps.now(); const batchId = randomUUID();
        await db.query(`INSERT INTO gyca_certificate_issue_batches
          (id,actor_id,action_id,request_hash,competition_id,stage,requested_count,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [batchId, actor, input.actionId, hash, competition, input.stage, input.entryIds.length, at]);
        for (const raw of rows) {
          const row = z.object({ id: z.uuid(), snapshot: z.object({ participant: z.record(z.string(), z.unknown()), work: z.record(z.string(), z.unknown()) }),
            public_content: z.object({ title: z.object({ en: z.string(), ko: z.string() }) }), result: CertificateStageSchema }).parse(raw);
          const recipientName = latinDisplay.safeParse(row.snapshot.participant.nameEn);
          const workTitle = latinDisplay.safeParse(row.snapshot.work.englishTitle);
          const competitionTitle = z.object({ en: latinDisplay, ko: z.string() }).safeParse(row.public_content.title);
          if (!recipientName.success || !workTitle.success || !competitionTitle.success) throw new EntryFault("ENTRY_LOCKED", 409);
          let existing = (await db.query("SELECT id FROM gyca_certificates WHERE entry_id=$1 AND stage=$2", [row.id, input.stage])).rows[0];
          if (!existing) {
            const id = randomUUID(); const number = `GYCA-${id.toUpperCase()}`;
            const snapshot = { recipientName: recipientName.data, workTitle: workTitle.data, competitionTitle: competitionTitle.data,
              stage: input.stage, certificateNumber: number, issueDate: at.toISOString().slice(0, 10) };
            await db.query(`INSERT INTO gyca_certificates
              (id,entry_id,competition_id,stage,certificate_number,snapshot,object_key,due_at,created_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)`, [id, row.id, competition, input.stage, number, snapshot, `certificates/${id}.pdf`, at]);
            await db.query("INSERT INTO gyca_certificate_events VALUES($1,$2,0,'queued',NULL,$3)", [randomUUID(), id, at]);
            existing = { id };
          }
          const certificate = z.object({ id: z.uuid() }).parse(existing);
          await db.query("INSERT INTO gyca_certificate_issue_batch_items VALUES($1,$2)", [batchId, certificate.id]);
        }
        return issueResult(db, batchId, input.stage);
      });
    }),
  };
}
