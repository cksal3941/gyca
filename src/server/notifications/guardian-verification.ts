import { z } from "zod";
import { GuardianVerificationResultSchema } from "../../contracts/guardian-admin.ts";
import { EntryIdSchema } from "../../contracts/index.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createSubmissionService } from "../entries/submissions.ts";

const requestRowSchema = z.object({
  id: z.uuid(), entry_id: EntryIdSchema, entry_revision: z.number().int().positive(), policy_token: z.string(),
  locale: z.enum(["en", "ko"]), expires_at: z.date(), accepted_at: z.date().nullable(),
});

export function createGuardianVerificationService(database: EntryDatabase, now: () => Date) {
  return {
    verify: (actor: string, scope: { readonly competitionId: string; readonly entryId: string; readonly requestId: string },
      input: { readonly entryRevision: number; readonly evidenceReference: string }) => database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      const entryRaw = (await db.query("SELECT owner_id FROM gyca_entries WHERE id=$1 AND competition_id=$2 FOR UPDATE",
        [scope.entryId, scope.competitionId])).rows[0];
      if (entryRaw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const owner = z.object({ owner_id: z.string() }).parse(entryRaw).owner_id;
      const raw = (await db.query(`SELECT r.*,c.accepted_at FROM gyca_guardian_requests r
        LEFT JOIN gyca_guardian_consents c ON c.request_id=r.id
        WHERE r.id=$1 AND r.entry_id=$2 FOR UPDATE OF r`, [scope.requestId, scope.entryId])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const request = requestRowSchema.parse(raw);
      const previous = (await db.query("SELECT * FROM gyca_guardian_verifications WHERE request_id=$1", [request.id])).rows[0];
      if (previous !== undefined) {
        const saved = z.object({ entry_revision: z.number(), evidence_reference: z.string(), verified_at: z.date() }).parse(previous);
        if (saved.entry_revision !== input.entryRevision || saved.evidence_reference !== input.evidenceReference)
          throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return GuardianVerificationResultSchema.parse({ requestId: request.id, entryId: request.entry_id,
          entryRevision: saved.entry_revision, verificationStatus: "verified", evidenceReference: saved.evidence_reference,
          verifiedAt: saved.verified_at.toISOString() });
      }
      if (request.accepted_at === null || request.expires_at <= now()) throw new EntryFault("GUARDIAN_VERIFICATION_REQUIRED", 409);
      if (request.entry_revision !== input.entryRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      const latest = z.object({ id: z.uuid() }).parse((await db.query(
        "SELECT id FROM gyca_guardian_requests WHERE entry_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [request.entry_id])).rows[0]);
      if (latest.id !== request.id) throw new EntryFault("CONSENT_REQUIRED", 409);
      const readiness = await createSubmissionService({ query: (sql, values) => db.query(sql, values), transaction: run => run(db) }, now)
        .readiness(owner, request.entry_id, request.locale);
      if (readiness.revision !== request.entry_revision || readiness.policyToken !== request.policy_token
        || readiness.blockingReasons.some(reason => reason !== "GUARDIAN_VERIFICATION_REQUIRED"))
        throw new EntryFault("CONSENT_REQUIRED", 409);
      const verifiedAt = now();
      await db.query(`INSERT INTO gyca_guardian_verifications
        (request_id,entry_id,entry_revision,policy_token,actor_id,evidence_reference,verified_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [request.id, request.entry_id, request.entry_revision, request.policy_token,
        actor, input.evidenceReference, verifiedAt]);
      return GuardianVerificationResultSchema.parse({ requestId: request.id, entryId: request.entry_id,
        entryRevision: request.entry_revision, verificationStatus: "verified", evidenceReference: input.evidenceReference,
        verifiedAt: verifiedAt.toISOString() });
    }),
  };
}
