import { z } from "zod";
import { GuardianEvidencePageSchema } from "../../contracts/guardian-admin.ts";
import { ConsentDocumentSchema } from "../../contracts/submissions.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";

const rowSchema = z.object({ id: z.uuid(), entry_revision: z.number().int(), locale: z.enum(["en", "ko"]),
  documents: z.array(ConsentDocumentSchema), created_at: z.date(), expires_at: z.date(),
  guardian_name: z.string().nullable(), accepted_at: z.date().nullable(),
  verified_at: z.date().nullable(), evidence_reference: z.string().nullable() });

export function createGuardianAdminHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string, entryId: string) => run(request, false, 200, actor => {
    const competition = parseRequest(z.string().min(1).max(128), competitionId);
    const entry = parseRequest(z.uuid(), entryId);
    const params = new URL(request.url).searchParams;
    const cursor = parseRequest(z.uuid().nullable(), params.get("cursor"));
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      if ((await db.query("SELECT id FROM gyca_entries WHERE id=$1 AND competition_id=$2", [entry, competition])).rows.length === 0)
        throw new EntryFault("NOT_FOUND", 404);
      const rows = (await db.query(`SELECT r.id,r.entry_revision,r.locale,r.documents,r.created_at,r.expires_at,c.guardian_name,c.accepted_at,
          v.verified_at,v.evidence_reference
        FROM gyca_guardian_requests r LEFT JOIN gyca_guardian_consents c ON c.request_id=r.id
        LEFT JOIN gyca_guardian_verifications v ON v.request_id=r.id
        WHERE r.entry_id=$1 AND ($2::uuid IS NULL OR r.id>$2) ORDER BY r.id LIMIT $3`, [entry, cursor, limit + 1])).rows.map(row => rowSchema.parse(row));
      const latestRaw = (await db.query(`SELECT r.id,r.entry_revision,r.locale,r.documents,r.created_at,r.expires_at,c.guardian_name,c.accepted_at,
          v.verified_at,v.evidence_reference
        FROM gyca_guardian_requests r LEFT JOIN gyca_guardian_consents c ON c.request_id=r.id
        LEFT JOIN gyca_guardian_verifications v ON v.request_id=r.id
        WHERE r.entry_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 1`, [entry])).rows[0];
      const latest = latestRaw === undefined ? null : rowSchema.parse(latestRaw);
      const verificationStatus = latest?.verified_at ? "verified"
        : latest?.accepted_at ? (latest.expires_at <= deps.now() ? "expired" : "pending_review") : "not_verified";
      const allowedActions = verificationStatus === "pending_review" ? ["verify_guardian" as const] : [];
      return GuardianEvidencePageSchema.parse({ entryId: entry, verificationStatus, allowedActions,
        items: rows.slice(0, limit).map(row => ({ requestId: row.id, entryRevision: row.entry_revision, locale: row.locale,
          documents: row.documents, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString(),
          guardianName: row.guardian_name, acceptedAt: row.accepted_at?.toISOString() ?? null,
          verification: row.verified_at === null || row.evidence_reference === null ? null : {
            verifiedAt: row.verified_at.toISOString(), evidenceReference: row.evidence_reference,
          } })),
        nextCursor: rows.length > limit ? rows.at(limit - 1)?.id ?? null : null });
    });
  });
}
