import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryIdSchema } from "../../contracts/index.ts";
import { ConsentDocumentSchema } from "../../contracts/submissions.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createSubmissionService } from "../entries/submissions.ts";
import type { ReceiptMailer } from "./resend.ts";
import { checkGuardianMailLimit } from "./guardian-rate-limit.ts";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const rowSchema = z.object({ id: z.uuid(), entry_id: EntryIdSchema, entry_revision: z.number(), policy_token: z.string(),
  locale: z.enum(["en", "ko"]), documents: z.array(ConsentDocumentSchema), expires_at: z.date() });
const atomic = (db: SqlConnection): EntryDatabase => ({ query: (sql, values) => db.query(sql, values), transaction: run => run(db) });
export function createGuardianConsent(database: EntryDatabase, runtime: {
  readonly mailer: ReceiptMailer | null; readonly origin: string | undefined; readonly now: () => Date;
}) {
  async function current(db: SqlConnection, row: z.infer<typeof rowSchema>, requireUnexpired = true) {
    if (requireUnexpired && row.expires_at <= runtime.now()) throw new EntryFault("CONSENT_REQUIRED", 409);
    const entry = (await db.query("SELECT owner_id FROM gyca_entries WHERE id=$1 FOR UPDATE", [row.entry_id])).rows[0];
    const owner = z.object({ owner_id: z.string() }).parse(entry).owner_id;
    const latest = z.object({ id: z.uuid() }).parse((await db.query("SELECT id FROM gyca_guardian_requests WHERE entry_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [row.entry_id])).rows[0]);
    if (latest.id !== row.id) throw new EntryFault("CONSENT_REQUIRED", 409);
    const readiness = await createSubmissionService(atomic(db), runtime.now).readiness(owner, row.entry_id, row.locale);
    if (readiness.revision !== row.entry_revision || readiness.policyToken !== row.policy_token
      || readiness.blockingReasons.some(reason => reason !== "GUARDIAN_VERIFICATION_REQUIRED")) throw new EntryFault("CONSENT_REQUIRED", 409);
  }
  return {
    status: (owner: string, entryId: string) => database.transaction(async db => {
      if ((await db.query("SELECT id FROM gyca_entries WHERE id=$1 AND owner_id=$2", [entryId, owner])).rows.length === 0)
        throw new EntryFault("NOT_FOUND", 404);
      const raw = (await db.query("SELECT * FROM gyca_guardian_requests WHERE entry_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [entryId])).rows[0];
      if (raw === undefined) return { state: "not_requested" };
      const row = rowSchema.parse(raw);
      try { await current(db, row, false); }
      catch (error) { if (error instanceof EntryFault && error.code === "CONSENT_REQUIRED") return { requestId: row.id, state: "stale" }; throw error; }
      const consent = (await db.query(`SELECT c.accepted_at,v.verified_at FROM gyca_guardian_consents c
        LEFT JOIN gyca_guardian_verifications v ON v.request_id=c.request_id WHERE c.request_id=$1`, [row.id])).rows[0];
      if (consent === undefined) return row.expires_at <= runtime.now()
        ? { requestId: row.id, state: "expired" } : { requestId: row.id, state: "pending" };
      const evidence = z.object({ accepted_at: z.date(), verified_at: z.date().nullable() }).parse(consent);
      if (evidence.verified_at !== null) return { requestId: row.id, state: "verified", verificationStatus: "verified" };
      if (row.expires_at <= runtime.now()) return { requestId: row.id, state: "expired" };
      return { requestId: row.id, state: "consented", verificationStatus: "pending_review" };
    }),
    async request(owner: string, input: { readonly entryId: string; readonly revision: number; readonly locale: "en" | "ko" }) {
      const mailer = runtime.mailer;
      if (mailer === null || runtime.origin === undefined) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const origin = new URL(runtime.origin);
      if (origin.protocol !== "https:" || origin.username || origin.password) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const token = randomBytes(32).toString("hex"); const id = randomUUID();
      const saved = await database.transaction(async db => {
        const raw = (await db.query(`SELECT guardian FROM gyca_entries WHERE id=$1 AND owner_id=$2 FOR UPDATE`, [input.entryId, owner])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
        await checkGuardianMailLimit(db, owner, runtime.now);
        const recipient = z.object({ guardian: z.object({ email: z.email() }) }).safeParse(raw);
        if (!recipient.success) throw new EntryFault("VALIDATION_FAILED", 422);
        const readiness = await createSubmissionService(atomic(db), runtime.now).readiness(owner, EntryIdSchema.parse(input.entryId), input.locale);
        if (readiness.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (readiness.policyToken === null || readiness.blockingReasons.length !== 1 || readiness.blockingReasons[0] !== "GUARDIAN_VERIFICATION_REQUIRED")
          throw new EntryFault("CONSENT_REQUIRED", 409);
        const at = runtime.now();
        if ((await db.query("SELECT id FROM gyca_guardian_requests WHERE entry_id=$1 AND created_at>$2 LIMIT 1", [input.entryId, new Date(at.getTime() - 60000)])).rows.length)
          throw new EntryFault("RATE_LIMITED", 429);
        const count = z.object({ count: z.number() }).parse((await db.query("SELECT count(*)::integer AS count FROM gyca_guardian_requests WHERE entry_id=$1", [input.entryId])).rows[0]);
        if (count.count >= 10) throw new EntryFault("RATE_LIMITED", 429);
        const expires = new Date(at.getTime() + 86400000);
        await db.query("INSERT INTO gyca_guardian_requests VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)",
          [id, input.entryId, hash(token), input.revision, readiness.policyToken, input.locale, recipient.data.guardian.email, JSON.stringify(readiness.documents), at, expires]);
        return { recipient: recipient.data.guardian.email, expiresAt: expires.toISOString() };
      });
      const link = new URL("/guardian-consent", origin); link.hash = token;
      await mailer.send({ from: mailer.from, to: [saved.recipient], subject: "GYCA — Guardian consent request / 보호자 동의 요청",
        text: `Please review the terms and confirm only if you are the participant's guardian.\n참가자의 보호자인 경우에만 내용을 확인하고 동의해주세요.\n${link.toString()}\nThis link expires in 24 hours. / 링크는 24시간 동안 유효합니다.` }, `gyca-guardian-${id}`);
      return { requestId: id, state: "pending", expiresAt: saved.expiresAt };
    },
    preview: (token: string) => database.transaction(async db => {
      const raw = (await db.query("SELECT * FROM gyca_guardian_requests WHERE token_hash=$1", [hash(token)])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = rowSchema.parse(raw); await current(db, row);
      return { requestId: row.id, documents: row.documents, expiresAt: row.expires_at.toISOString() };
    }),
    accept: (input: { readonly token: string; readonly guardianName: string }) => database.transaction(async db => {
      const raw = (await db.query("SELECT * FROM gyca_guardian_requests WHERE token_hash=$1", [hash(input.token)])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = rowSchema.parse(raw); await current(db, row);
      const prior = (await db.query("SELECT guardian_name FROM gyca_guardian_consents WHERE request_id=$1", [row.id])).rows[0];
      if (prior !== undefined && z.object({ guardian_name: z.string() }).parse(prior).guardian_name !== input.guardianName)
        throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
      await db.query("INSERT INTO gyca_guardian_consents VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [row.id, input.guardianName, runtime.now()]);
      const verified = (await db.query("SELECT request_id FROM gyca_guardian_verifications WHERE request_id=$1", [row.id])).rows.length > 0;
      return verified ? { requestId: row.id, state: "verified", verificationStatus: "verified" }
        : { requestId: row.id, state: "consented", verificationStatus: "pending_review" };
    }),
  };
}
