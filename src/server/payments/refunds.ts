import { z } from "zod";
import { PAYMENT_STATES } from "../../contracts/index.ts";
import { PaymentOrderSchema } from "../../contracts/payments.ts";
import { RefundOverviewSchema, RefundRecordSchema, type RequestRefund } from "../../contracts/refunds.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { RefundEvidenceSchema, type PaymentProvider } from "./provider.ts";

const scopeSchema = z.object({ permission: z.enum(["viewer", "operator"]) });
const orderSchema = z.object({ id: z.uuid(), entry_id: z.uuid(), competition_id: z.string(), amount_minor: z.coerce.number().int().positive(),
  currency: z.literal("EUR"), state: z.enum(PAYMENT_STATES), needs_review: z.boolean(), created_at: z.coerce.date(),
  payment_closes_at: z.coerce.date(), approval_basis: z.enum(["provider_paid_at", "server_verified_at"]), policy_version: z.string(),
  provider: z.string(), merchant_account: z.string(), live_mode: z.boolean(), provider_payment_id: z.string().nullable() });
const refundRowSchema = z.object({ id: z.uuid(), order_id: z.uuid(), amount_minor: z.coerce.number().int().positive(), currency: z.literal("EUR"),
  state: z.enum(["pending", "succeeded", "failed"]), reason: z.string(), requested_by: z.string(), requested_at: z.coerce.date(),
  provider_refund_id: z.string().nullable(), refunded_at: z.coerce.date().nullable() });
type Scope = { readonly actor: string; readonly competitionId: string };
type OrderRow = z.infer<typeof orderSchema>;
type RefundRow = z.infer<typeof refundRowSchema>;

async function authorize(db: SqlConnection, scope: Scope) {
  const row = (await db.query("SELECT permission FROM gyca_payment_permissions WHERE user_id=$1 AND competition_id=$2 FOR SHARE",
    [scope.actor, scope.competitionId])).rows[0];
  if (row === undefined) throw new EntryFault("FORBIDDEN", 403);
  return scopeSchema.parse(row).permission;
}
function matching(providers: readonly PaymentProvider[], order: OrderRow) {
  return providers.find(provider => provider.id === order.provider && provider.merchantAccount === order.merchant_account
    && provider.liveMode === order.live_mode) ?? null;
}
function paymentOrder(row: OrderRow) {
  return PaymentOrderSchema.parse({ id: row.id, entryId: row.entry_id, kind: "entry_fee",
    money: { amountMinor: row.amount_minor, currency: row.currency }, state: row.state, needsReview: row.needs_review,
    createdAt: row.created_at.toISOString(), paymentClosesAtExclusive: row.payment_closes_at.toISOString(),
    approvalBasis: row.approval_basis, policyVersion: row.policy_version, allowedActions: [], blockingReasons: [] });
}
function record(row: RefundRow) {
  return RefundRecordSchema.parse({ id: row.id, orderId: row.order_id,
    money: { amountMinor: row.amount_minor, currency: row.currency }, state: row.state, reason: row.reason,
    requestedAt: row.requested_at.toISOString(), refundedAt: row.refunded_at?.toISOString() ?? null });
}
async function scopedOrder(db: SqlConnection, scope: Scope, orderId: string, lock = false) {
  const row = (await db.query(`SELECT o.*,e.competition_id FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
    WHERE o.id=$1 AND e.competition_id=$2${lock ? " FOR UPDATE OF o" : ""}`, [orderId, scope.competitionId])).rows[0];
  if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
  return orderSchema.parse(row);
}
async function rowsFor(db: SqlConnection, orderId: string) {
  return z.array(refundRowSchema).parse((await db.query(
    "SELECT * FROM gyca_refunds WHERE order_id=$1 ORDER BY requested_at,id", [orderId])).rows);
}

export function createPaymentRefunds(database: EntryDatabase, providers: readonly PaymentProvider[], now: () => Date) {
  async function overview(scope: Scope, orderId: string) {
    return database.transaction(async db => {
      const permission = await authorize(db, scope);
      const order = await scopedOrder(db, scope, orderId);
      const refunds = await rowsFor(db, orderId);
      const refunded = refunds.filter(item => item.state === "succeeded").reduce((sum, item) => sum + item.amount_minor, 0);
      const pending = refunds.filter(item => item.state === "pending").reduce((sum, item) => sum + item.amount_minor, 0);
      const remaining = Math.max(0, order.amount_minor - refunded - pending);
      const provider = matching(providers, order);
      return RefundOverviewSchema.parse({ orderId, money: { amountMinor: order.amount_minor, currency: order.currency },
        refundedAmountMinor: refunded, pendingAmountMinor: pending, remainingAmountMinor: remaining,
        refunds: refunds.map(record), allowedActions: permission === "operator" && order.state === "succeeded" && !order.needs_review
          && remaining > 0 && provider?.refund !== undefined ? ["request_refund"] : [] });
    });
  }
  return {
    overview,
    request: async (scope: Scope, orderId: string, input: RequestRefund) => {
      const reservation = await database.transaction(async db => {
        if (await authorize(db, scope) !== "operator") throw new EntryFault("FORBIDDEN", 403);
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`refund:${input.actionId}`]);
        const order = await scopedOrder(db, scope, orderId, true);
        const previousRaw = (await db.query("SELECT * FROM gyca_refunds WHERE id=$1", [input.actionId])).rows[0];
        if (previousRaw !== undefined) {
          const previous = refundRowSchema.parse(previousRaw);
          if (previous.order_id !== orderId || previous.requested_by !== scope.actor || previous.amount_minor !== input.amountMinor
            || previous.reason !== input.reason) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          if (previous.state !== "pending") return { order, provider: null, refund: previous };
          const provider = matching(providers, order);
          if (provider?.refund === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
          return { order, provider, refund: previous };
        }
        const provider = matching(providers, order);
        if (provider?.refund === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
        if (order.state !== "succeeded" || order.needs_review || order.provider_payment_id === null)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const totals = z.object({ reserved: z.coerce.number().int().nonnegative() }).parse((await db.query(`SELECT COALESCE(sum(amount_minor),0) AS reserved
          FROM gyca_refunds WHERE order_id=$1 AND state IN ('pending','succeeded')`, [orderId])).rows[0]);
        if (input.amountMinor > order.amount_minor - totals.reserved) throw new EntryFault("REVISION_CONFLICT", 409);
        const requestedAt = now();
        const saved = refundRowSchema.parse((await db.query(`INSERT INTO gyca_refunds
          (id,order_id,amount_minor,currency,reason,requested_by,requested_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [input.actionId, orderId, input.amountMinor, order.currency, input.reason, scope.actor, requestedAt])).rows[0]);
        return { order, provider, refund: saved };
      });
      if (reservation.refund.state !== "pending") return record(reservation.refund);
      const paymentId = reservation.order.provider_payment_id;
      if (paymentId === null || reservation.provider?.refund === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const evidence = RefundEvidenceSchema.parse(await reservation.provider.refund(paymentOrder(reservation.order), paymentId,
        reservation.refund.amount_minor, reservation.refund.reason, reservation.refund.id));
      if (evidence.orderId !== orderId || evidence.paymentId !== paymentId || evidence.amountMinor !== reservation.refund.amount_minor
        || evidence.currency !== reservation.order.currency) throw new EntryFault("FORBIDDEN", 403);
      return database.transaction(async db => {
        await authorize(db, scope);
        await scopedOrder(db, scope, orderId, true);
        const current = refundRowSchema.parse((await db.query("SELECT * FROM gyca_refunds WHERE id=$1 FOR UPDATE", [input.actionId])).rows[0]);
        if (current.state === "succeeded") {
          if (current.provider_refund_id !== evidence.refundId || current.refunded_at?.getTime() !== Date.parse(evidence.refundedAt))
            throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return record(current);
        }
        if (current.state !== "pending") throw new EntryFault("REVISION_CONFLICT", 409);
        const updated = refundRowSchema.parse((await db.query(`UPDATE gyca_refunds SET state='succeeded',provider_refund_id=$2,refunded_at=$3
          WHERE id=$1 AND state='pending' RETURNING *`, [input.actionId, evidence.refundId, evidence.refundedAt])).rows[0]);
        return record(updated);
      });
    },
  };
}
