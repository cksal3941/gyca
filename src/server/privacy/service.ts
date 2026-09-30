import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { AdminPrivacyRequestPageSchema, AdminPrivacyRequestSchema, PRIVACY_REASON_CODES, PRIVACY_REQUEST_STATES,
  PrivacyRequestPageSchema, PrivacyRequestSchema } from "../../contracts/privacy-requests.ts";
import type { ReviewPrivacyRequest } from "../../contracts/privacy-requests.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ id: z.uuid(), owner_id: z.string(), owner_email: z.string().optional(),
  kind: z.literal("account_closure_and_erasure"), state: z.enum(PRIVACY_REQUEST_STATES), revision: z.number().int().positive(),
  requested_at: z.coerce.date(), updated_at: z.coerce.date(), reason_code: z.enum(PRIVACY_REASON_CODES).optional(),
  evidence_reference: z.string().nullable().optional(), transition_at: z.coerce.date().optional() });
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function participant(row: z.infer<typeof rowSchema>) {
  return PrivacyRequestSchema.parse({ id: row.id, kind: row.kind, state: row.state, revision: row.revision,
    requestedAt: row.requested_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    allowedActions: row.state === "submitted" ? ["cancel_privacy_request"] : [] });
}
function adminActions(state: z.infer<typeof rowSchema>["state"]) {
  if (state === "submitted") return ["start_review"] as const;
  if (state === "under_review") return ["place_retention_hold", "approve_for_execution"] as const;
  if (state === "retention_hold") return ["resume_review"] as const;
  return [] as const;
}
function admin(row: z.infer<typeof rowSchema>) {
  return AdminPrivacyRequestSchema.parse({ ...participant(row), requester: { accountId: row.owner_id, email: row.owner_email },
    lastTransition: { reasonCode: row.reason_code, evidenceReference: row.evidence_reference ?? null,
      at: row.transition_at?.toISOString() }, allowedActions: adminActions(row.state) });
}
async function replay(db: SqlConnection, actor: string, actionId: string, requestHash: string) {
  const raw = (await db.query("SELECT request_hash,response FROM gyca_privacy_request_actions WHERE actor_id=$1 AND action_id=$2", [actor, actionId])).rows[0];
  if (raw === undefined) return null;
  const saved = z.object({ request_hash: z.string(), response: z.unknown() }).parse(raw);
  if (saved.request_hash !== requestHash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
  return saved.response;
}
async function saveAction(db: SqlConnection, actor: string, actionId: string, requestHash: string, response: unknown, at: Date) {
  await db.query("INSERT INTO gyca_privacy_request_actions(actor_id,action_id,request_hash,response,created_at) VALUES($1,$2,$3,$4::jsonb,$5)",
    [actor, actionId, requestHash, JSON.stringify(response), at]);
}

export function createPrivacyRequestService(database: EntryDatabase, now: () => Date) {
  return {
    create(actor: string, input: { readonly actionId: string; readonly kind: "account_closure_and_erasure" }) {
      return database.transaction(async db => {
        const requestHash = hash(input); const saved = await replay(db, actor, input.actionId, requestHash);
        if (saved !== null) return PrivacyRequestSchema.parse(saved);
        await db.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [actor]);
        if ((await db.query("SELECT id FROM gyca_privacy_requests WHERE owner_id=$1 AND state<>'cancelled'", [actor])).rows.length)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now(); const id = randomUUID();
        await db.query(`INSERT INTO gyca_privacy_requests(id,owner_id,kind,state,revision,requested_at,updated_at)
          VALUES($1,$2,$3,'submitted',1,$4,$4)`, [id, actor, input.kind, at]);
        await db.query(`INSERT INTO gyca_privacy_request_transitions(request_id,revision,state,actor_id,reason_code,created_at)
          VALUES($1,1,'submitted',$2,'USER_REQUESTED',$3)`, [id, actor, at]);
        const result = PrivacyRequestSchema.parse({ id, kind: input.kind, state: "submitted", revision: 1,
          requestedAt: at.toISOString(), updatedAt: at.toISOString(), allowedActions: ["cancel_privacy_request"] });
        await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
      });
    },
    list(actor: string, cursor: string | null, limit: number) {
      return database.transaction(async db => {
        const rows = (await db.query(`SELECT id,owner_id,kind,state,revision,requested_at,updated_at FROM gyca_privacy_requests
          WHERE owner_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`, [actor, cursor, limit + 1])).rows.map(row => rowSchema.parse(row));
        const page = rows.slice(0, limit); return PrivacyRequestPageSchema.parse({ items: page.map(participant),
          nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null });
      });
    },
    cancel(actor: string, requestId: string, input: { readonly actionId: string; readonly expectedRevision: number }) {
      return database.transaction(async db => {
        const requestHash = hash({ requestId, ...input }); const saved = await replay(db, actor, input.actionId, requestHash);
        if (saved !== null) return PrivacyRequestSchema.parse(saved);
        const raw = (await db.query("SELECT * FROM gyca_privacy_requests WHERE id=$1 AND owner_id=$2 FOR UPDATE", [requestId, actor])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.state !== "submitted") throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now(); const revision = row.revision + 1;
        await db.query(`INSERT INTO gyca_privacy_request_transitions(request_id,revision,state,actor_id,reason_code,created_at)
          VALUES($1,$2,'cancelled',$3,'USER_CANCELLED',$4)`, [requestId, revision, actor, at]);
        await db.query("UPDATE gyca_privacy_requests SET state='cancelled',revision=$2,updated_at=$3 WHERE id=$1", [requestId, revision, at]);
        const result = PrivacyRequestSchema.parse({ id: row.id, kind: row.kind, state: "cancelled", revision,
          requestedAt: row.requested_at.toISOString(), updatedAt: at.toISOString(), allowedActions: [] });
        await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
      });
    },
    listAdmin(actor: string, state: string | null, cursor: string | null, limit: number) {
      return database.transaction(async db => {
        if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
          throw new EntryFault("FORBIDDEN", 403);
        const rows = (await db.query(`SELECT r.*,u.email AS owner_email,t.reason_code,t.evidence_reference,t.created_at AS transition_at
          FROM gyca_privacy_requests r JOIN "user" u ON u.id=r.owner_id
          JOIN gyca_privacy_request_transitions t ON t.request_id=r.id AND t.revision=r.revision
          WHERE ($1::text IS NULL OR r.state=$1) AND ($2::uuid IS NULL OR r.id>$2) ORDER BY r.id LIMIT $3`,
        [state, cursor, limit + 1])).rows.map(row => rowSchema.parse(row));
        const page = rows.slice(0, limit); return AdminPrivacyRequestPageSchema.parse({ items: page.map(admin),
          nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null });
      });
    },
    review(actor: string, requestId: string, input: ReviewPrivacyRequest) {
      return database.transaction(async db => {
        if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
          throw new EntryFault("FORBIDDEN", 403);
        const requestHash = hash({ requestId, ...input }); const saved = await replay(db, actor, input.actionId, requestHash);
        if (saved !== null) return AdminPrivacyRequestSchema.parse(saved);
        const raw = (await db.query(`SELECT r.*,u.email AS owner_email FROM gyca_privacy_requests r JOIN "user" u ON u.id=r.owner_id
          WHERE r.id=$1 FOR UPDATE OF r`, [requestId])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        const transition = input.decision === "start_review" && row.state === "submitted"
          ? { state: "under_review" as const, reason: "REVIEW_STARTED" as const, evidence: null }
          : input.decision === "resume_review" && row.state === "retention_hold"
            ? { state: "under_review" as const, reason: "REVIEW_RESUMED" as const, evidence: null }
            : input.decision === "place_retention_hold" && row.state === "under_review"
              ? { state: "retention_hold" as const, reason: input.reasonCode, evidence: input.evidenceReference }
              : input.decision === "approve_for_execution" && row.state === "under_review"
                ? { state: "approved_for_execution" as const, reason: input.reasonCode, evidence: input.evidenceReference }
                : null;
        if (transition === null) throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now(); const revision = row.revision + 1;
        await db.query(`INSERT INTO gyca_privacy_request_transitions(request_id,revision,state,actor_id,reason_code,evidence_reference,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7)`, [requestId, revision, transition.state, actor, transition.reason, transition.evidence, at]);
        await db.query("UPDATE gyca_privacy_requests SET state=$2,revision=$3,updated_at=$4 WHERE id=$1", [requestId, transition.state, revision, at]);
        const result = AdminPrivacyRequestSchema.parse({ id: row.id, kind: row.kind, state: transition.state, revision,
          requestedAt: row.requested_at.toISOString(), updatedAt: at.toISOString(), requester: { accountId: row.owner_id, email: row.owner_email },
          lastTransition: { reasonCode: transition.reason, evidenceReference: transition.evidence, at: at.toISOString() },
          allowedActions: adminActions(transition.state) });
        await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
      });
    },
  };
}
