import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PAYMENT_STATES, ERROR_CODES } from "../../contracts/index.ts";
import { AcceptLatePaymentResultSchema, PAYMENT_REVIEW_REASONS, PaymentAdminActionSchema, PaymentReviewSchema,
  type AcceptLatePaymentRequest, type RequeueRecoveryRequest } from "../../contracts/payment-admin.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { PaymentEvidenceSchema } from "./provider.ts";

const scopeSchema = z.object({ permission: z.enum(["viewer", "operator"]) });
const orderSchema = z.object({ id: z.uuid(), entry_id: z.uuid(), amount_minor: z.coerce.number(),
  currency: z.literal("EUR"), state: z.enum(PAYMENT_STATES), needs_review: z.boolean(),
  recovery_state: z.enum(["pending", "running", "completed", "stalled"]).nullable(),
  attempts: z.number().int().nullable(), updated_at: z.date().nullable(),
  last_error_code: z.string().nullable(), due_at: z.date().nullable(), lease_until: z.date().nullable(),
  order_created_at: z.date(), payment_closes_at: z.date(), approval_basis: z.enum(["provider_paid_at", "server_verified_at"]),
  provider_payment_id: z.string().nullable(), paid_at: z.date().nullable(), entry_status: z.string(), submitted_at: z.date().nullable(),
  review_evidence: z.unknown().nullable(), review_verified_at: z.date().nullable(), review_event_count: z.coerce.number().int().nonnegative(),
  payment_identity_reused: z.boolean() });
type Scope = { readonly actor: string; readonly competitionId: string };
async function authorize(db: SqlConnection, scope: Scope) {
  const row = (await db.query(`SELECT permission FROM gyca_payment_permissions
    WHERE user_id=$1 AND competition_id=$2 FOR SHARE`, [scope.actor, scope.competitionId])).rows[0];
  if (row === undefined) throw new EntryFault("FORBIDDEN", 403);
  return scopeSchema.parse(row).permission;
}
const selection = `SELECT o.id,o.entry_id,o.amount_minor,o.currency,o.state,o.needs_review,
  j.state AS recovery_state,j.attempts,j.updated_at,j.last_error_code,j.due_at,j.lease_until,
  o.created_at AS order_created_at,o.payment_closes_at,o.approval_basis,o.provider_payment_id,o.paid_at,
  e.status AS entry_status,e.submitted_at,review.evidence AS review_evidence,review.verified_at AS review_verified_at,
  (SELECT count(*)::int FROM gyca_payment_events counted WHERE counted.order_id=o.id AND counted.outcome='review') AS review_event_count,
  EXISTS(SELECT 1 FROM gyca_orders other WHERE other.id<>o.id AND other.provider=o.provider
    AND other.merchant_account=o.merchant_account AND other.live_mode=o.live_mode
    AND other.provider_payment_id=review.evidence->>'paymentId') AS payment_identity_reused
  FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
  LEFT JOIN gyca_payment_recovery j ON j.order_id=o.id
  LEFT JOIN LATERAL (SELECT event.evidence,event.verified_at FROM gyca_payment_events event
    WHERE event.order_id=o.id AND event.outcome='review' ORDER BY event.verified_at,event.event_id LIMIT 1) review ON true`;

function paymentReviewReasons(row: z.infer<typeof orderSchema>) {
  if (!row.needs_review) return [];
  const parsed = PaymentEvidenceSchema.safeParse(row.review_evidence);
  if (!parsed.success || row.review_verified_at === null) return ["LEGACY_UNKNOWN" as const];
  const evidence = parsed.data;
  const reasons: (typeof PAYMENT_REVIEW_REASONS)[number][] = [];
  if (evidence.amountMinor !== row.amount_minor) reasons.push("AMOUNT_MISMATCH");
  if (evidence.currency !== row.currency) reasons.push("CURRENCY_MISMATCH");
  if (evidence.requiresReview === true) reasons.push("PROVIDER_REVIEW_REQUIRED");
  // The payment writer stops at these top-level checks, so later temporal checks did not cause this review event.
  if (reasons.length > 0) return [...new Set(reasons)];
  if (evidence.state === "succeeded" && evidence.paidAt !== null) {
    const paidAt = new Date(evidence.paidAt);
    if (paidAt > row.review_verified_at) return ["PAID_AT_AFTER_VERIFICATION" as const];
    if (paidAt < row.order_created_at) return ["PAID_AT_BEFORE_ORDER" as const];
    if (row.provider_payment_id !== null && (row.provider_payment_id !== evidence.paymentId
      || row.paid_at?.getTime() !== paidAt.getTime())) return ["PAYMENT_EVIDENCE_CONFLICT" as const];
    if (row.payment_identity_reused) return ["PAYMENT_IDENTITY_REUSED" as const];
    const basis = row.approval_basis === "provider_paid_at" ? paidAt : row.review_verified_at;
    if (basis >= row.payment_closes_at) reasons.push("APPROVED_AFTER_DEADLINE");
    if (row.entry_status !== "submitted" || row.submitted_at === null) reasons.push("ENTRY_STATE_CONFLICT");
  }
  return reasons.length === 0 ? ["LEGACY_UNKNOWN" as const] : [...new Set(reasons)];
}

function presentOrder(row: z.infer<typeof orderSchema>, permission: "viewer" | "operator") {
  const error = z.enum(ERROR_CODES).safeParse(row.last_error_code);
  return PaymentReviewSchema.parse({
    orderId: row.id, entryId: row.entry_id, money: { amountMinor: row.amount_minor, currency: row.currency },
    state: row.state, needsReview: row.needs_review, reviewReasons: paymentReviewReasons(row),
    reviewedAt: row.needs_review ? row.review_verified_at?.toISOString() ?? null : null,
    recovery: row.recovery_state === null ? null : { state: row.recovery_state, attempts: row.attempts, updatedAt: row.updated_at?.toISOString(),
      lastErrorCode: row.last_error_code === null ? null : error.success ? error.data : "INTERNAL_ERROR",
      nextAttemptAt: row.recovery_state === "pending" ? row.due_at?.toISOString() ?? null : null,
      leaseExpiresAt: row.recovery_state === "running" ? row.lease_until?.toISOString() ?? null : null,
    },
    allowedActions: permission !== "operator" ? [] : [
      ...(row.recovery_state === "stalled" && row.state !== "succeeded" && !row.needs_review ? ["requeue_recovery" as const] : []),
      ...(row.state === "succeeded" && row.needs_review && row.entry_status === "submitted" && row.submitted_at !== null
        && row.review_event_count === 1
        && paymentReviewReasons(row).length === 1 && paymentReviewReasons(row)[0] === "APPROVED_AFTER_DEADLINE"
        ? ["accept_late_payment" as const] : []),
    ],
  });
}

export function createPaymentAdmin(database: EntryDatabase, now: () => Date) {
  return {
    detail(scope: Scope, orderId: string) {
      return database.transaction(async db => {
        const permission = await authorize(db, scope);
        const row = (await db.query(`${selection} WHERE o.id=$1 AND e.competition_id=$2`, [orderId, scope.competitionId])).rows[0];
        if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
        return presentOrder(orderSchema.parse(row), permission);
      });
    },
    history(scope: Scope, target: { readonly orderId: string; readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async (db) => {
        await authorize(db, scope);
        const order = (await db.query(`SELECT o.id FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
          WHERE o.id=$1 AND e.competition_id=$2`, [target.orderId, scope.competitionId])).rows[0];
        if (order === undefined) throw new EntryFault("NOT_FOUND", 404);
        const rows = (await db.query(`SELECT id,actor_id,action,reason,created_at FROM gyca_payment_admin_actions
          WHERE order_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`,
          [target.orderId, target.cursor, target.limit + 1])).rows.map(row => z.object({
          id: z.uuid(), actor_id: z.string(), action: z.enum(["requeue_recovery", "accept_late_payment"]), reason: z.string(), created_at: z.date(),
        }).parse(row));
        const items = rows.slice(0, target.limit).map(row => PaymentAdminActionSchema.parse({
          id: row.id, actorId: row.actor_id, action: row.action, reason: row.reason, createdAt: row.created_at.toISOString(),
        }));
        return { items, nextCursor: rows.length > target.limit ? items.at(-1)?.id ?? null : null };
      });
    },
    list(scope: Scope, page: { readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async (db) => {
        const permission = await authorize(db, scope);
        const rows = (await db.query(`${selection} WHERE e.competition_id=$1
          AND (o.needs_review OR j.state='stalled') AND ($2::uuid IS NULL OR o.id>$2)
          ORDER BY o.id LIMIT $3`, [scope.competitionId, page.cursor, page.limit + 1])).rows.map(row => orderSchema.parse(row));
        const items = rows.slice(0, page.limit).map(row => presentOrder(row, permission));
        return { items, nextCursor: rows.length > page.limit ? items.at(-1)?.orderId ?? null : null };
      });
    },
    requeue(scope: Scope, orderId: string, input: RequeueRecoveryRequest) {
      return database.transaction(async (db) => {
        if (await authorize(db, scope) !== "operator") throw new EntryFault("FORBIDDEN", 403);
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`payment_admin:${input.actionId}`]);
        const row = (await db.query(`${selection} WHERE o.id=$1 AND e.competition_id=$2 FOR UPDATE OF o`, [orderId, scope.competitionId])).rows[0];
        if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
        const prior = (await db.query(`SELECT actor_id,order_id,reason,expected_updated_at FROM gyca_payment_admin_actions WHERE id=$1`, [input.actionId])).rows[0];
        if (prior !== undefined) {
          const saved = z.object({ actor_id: z.string(), order_id: z.uuid(), reason: z.string(), expected_updated_at: z.date() }).parse(prior);
          if (saved.actor_id !== scope.actor || saved.order_id !== orderId || saved.reason !== input.reason || saved.expected_updated_at.getTime() !== Date.parse(input.expectedUpdatedAt))
            throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return { actionId: input.actionId, outcome: "recovery_queued" };
        }
        const order = orderSchema.parse(row);
        if (order.state === "succeeded" || order.needs_review) throw new EntryFault("REVISION_CONFLICT", 409);
        const at = now();
        const changed = await db.query(`UPDATE gyca_payment_recovery SET state='pending',attempts=0,due_at=$3,
          last_error_code=NULL,updated_at=$3 WHERE order_id=$1 AND state='stalled' AND updated_at=$2 RETURNING order_id`,
          [orderId, input.expectedUpdatedAt, at]);
        if (changed.rows.length === 0) throw new EntryFault("REVISION_CONFLICT", 409);
        await db.query(`INSERT INTO gyca_payment_admin_actions(id,actor_id,order_id,reason,expected_updated_at,created_at,action)
          VALUES($1,$2,$3,$4,$5,$6,'requeue_recovery')`, [input.actionId, scope.actor, orderId, input.reason, input.expectedUpdatedAt, at]);
        return { actionId: input.actionId, outcome: "recovery_queued" };
      });
    },
    acceptLatePayment(scope: Scope, orderId: string, input: AcceptLatePaymentRequest) {
      return database.transaction(async (db) => {
        if (await authorize(db, scope) !== "operator") throw new EntryFault("FORBIDDEN", 403);
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`payment_admin:${input.actionId}`]);
        const target = (await db.query(`SELECT o.entry_id FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
          WHERE o.id=$1 AND e.competition_id=$2`, [orderId, scope.competitionId])).rows[0];
        if (target === undefined) throw new EntryFault("NOT_FOUND", 404);
        const entryId = z.object({ entry_id: z.uuid() }).parse(target).entry_id;
        // Payment writers lock entry then order. Keep the same order to avoid a webhook/admin deadlock.
        await db.query("SELECT id FROM gyca_entries WHERE id=$1 FOR UPDATE", [entryId]);
        const raw = (await db.query(`${selection} WHERE o.id=$1 AND e.competition_id=$2 FOR UPDATE OF o`,
          [orderId, scope.competitionId])).rows[0];
        if (raw === undefined) throw new EntryFault("REVISION_CONFLICT", 409);
        const prior = (await db.query(`SELECT action,actor_id,order_id,reason,expected_updated_at FROM gyca_payment_admin_actions WHERE id=$1`,
          [input.actionId])).rows[0];
        if (prior !== undefined) {
          const saved = z.object({ action: z.string(), actor_id: z.string(), order_id: z.uuid(), reason: z.string(),
            expected_updated_at: z.date() }).parse(prior);
          if (saved.action !== "accept_late_payment" || saved.actor_id !== scope.actor || saved.order_id !== orderId
          || saved.reason !== input.reason || saved.expected_updated_at.getTime() !== Date.parse(input.expectedReviewedAt))
            throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          const replay = z.object({ entry_id: z.uuid(), receipt_number: z.string(), received_at: z.date() }).parse((await db.query(
            "SELECT o.entry_id,e.receipt_number,e.received_at FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id WHERE o.id=$1", [orderId])).rows[0]);
          return AcceptLatePaymentResultSchema.parse({ actionId: input.actionId, outcome: "receipt_issued", entryId: replay.entry_id,
            receiptNumber: replay.receipt_number, receivedAt: replay.received_at.toISOString() });
        }
        const row = orderSchema.parse(raw); const reasons = paymentReviewReasons(row);
        if (row.review_verified_at === null || row.review_verified_at.getTime() !== Date.parse(input.expectedReviewedAt)
          || row.state !== "succeeded" || !row.needs_review || row.entry_status !== "submitted" || row.submitted_at === null
          || row.review_event_count !== 1
          || reasons.length !== 1 || reasons[0] !== "APPROVED_AFTER_DEADLINE") throw new EntryFault("REVISION_CONFLICT", 409);
        const at = now(); const receiptNumber = `GYCA-${randomUUID().toUpperCase()}`;
        await db.query("UPDATE gyca_orders SET needs_review=false WHERE id=$1 AND needs_review=true", [orderId]);
        const received = await db.query(`UPDATE gyca_entries SET status='received',received_at=$2,receipt_number=$3,
          revision=revision+1,updated_at=$2 WHERE id=$1 AND status='submitted' AND submitted_at IS NOT NULL RETURNING id`,
          [row.entry_id, at, receiptNumber]);
        if (received.rows.length === 0) throw new EntryFault("REVISION_CONFLICT", 409);
        await db.query(`INSERT INTO gyca_payment_outbox(key,kind,entry_id,order_id,created_at)
          VALUES($1,'entry_received',$2,$3,$4) ON CONFLICT DO NOTHING`, [`entry_received:${row.entry_id}`, row.entry_id, orderId, at]);
        await db.query(`INSERT INTO gyca_payment_admin_actions(id,actor_id,order_id,reason,expected_updated_at,created_at,action)
          VALUES($1,$2,$3,$4,$5,$6,'accept_late_payment')`,
          [input.actionId, scope.actor, orderId, input.reason, input.expectedReviewedAt, at]);
        return AcceptLatePaymentResultSchema.parse({ actionId: input.actionId, outcome: "receipt_issued", entryId: row.entry_id,
          receiptNumber, receivedAt: at.toISOString() });
      });
    },
  };
}
