import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryIdSchema, LocalizedTextSchema, OrderIdSchema, OrderSummarySchema, MoneySchema, PAYMENT_STATES, WorkDraftSchema } from "../../contracts/index.ts";
import type { EntryId, OrderId, OrderSummary, Page } from "../../contracts/index.ts";
import { PaymentCheckoutSessionSchema, PaymentOrderSchema } from "../../contracts/payments.ts";
import type { PaymentOrder } from "../../contracts/payments.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { PaymentEvidenceSchema } from "./provider.ts";
import type { PaymentProvider } from "./provider.ts";

const rowSchema = z.object({ id: OrderIdSchema, entry_id: EntryIdSchema, amount_minor: z.coerce.number(), currency: z.literal("EUR"),
  state: z.enum(PAYMENT_STATES), needs_review: z.boolean(), created_at: z.coerce.date(), payment_closes_at: z.coerce.date(),
  approval_basis: z.enum(["provider_paid_at", "server_verified_at"]), policy_version: z.string(),
  provider: z.string(), merchant_account: z.string(), live_mode: z.boolean(), provider_payment_id: z.string().nullable(),
  paid_at: z.coerce.date().nullable(), next_reconcile_at: z.coerce.date().nullable() });
type OrderRow = z.infer<typeof rowSchema>;
const entrySchema = z.object({ id: EntryIdSchema, status: z.string(), competition_id: z.string(), submitted_at: z.coerce.date().nullable() });
const summaryRowSchema = rowSchema.extend({ competition_id: z.string(), snapshot: z.unknown(), public_content: z.unknown().nullable(),
  refunded_amount: z.coerce.number().int().nonnegative(), pending_refund_amount: z.coerce.number().int().nonnegative(),
  failed_refund_amount: z.coerce.number().int().nonnegative() });
const summarySnapshotSchema = z.object({
  work: WorkDraftSchema.optional(),
  competition: z.object({ public_content: z.unknown().nullable().optional() }).passthrough().optional(),
}).passthrough();
const titleContentSchema = z.object({ title: LocalizedTextSchema }).passthrough();
import { PaymentPolicySchema as policySchema } from "../../contracts/payment-policy.ts";
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function ownedEntry(db: SqlConnection, owner: string, id: EntryId) {
  const raw = (await db.query("SELECT * FROM gyca_entries WHERE id=$1 AND owner_id=$2 FOR UPDATE", [id, owner])).rows[0];
  if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
  return entrySchema.parse(raw);
}
async function ownedOrder(db: SqlConnection, owner: string, id: OrderId): Promise<OrderRow> {
  const raw = (await db.query("SELECT o.* FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id WHERE o.id=$1 AND e.owner_id=$2", [id, owner])).rows[0];
  if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
  return rowSchema.parse(raw);
}
function matching(provider: PaymentProvider | null, order: OrderRow): provider is PaymentProvider {
  return provider !== null && provider.id === order.provider && provider.merchantAccount === order.merchant_account && provider.liveMode === order.live_mode;
}
function project(row: OrderRow, provider: PaymentProvider | null, now: Date): PaymentOrder {
  const canStart = matching(provider, row) && provider.beginCheckout !== undefined && !row.needs_review
    && row.state === "pending" && now < row.payment_closes_at;
  const canCheck = matching(provider, row) && !row.needs_review && row.state !== "succeeded";
  return PaymentOrderSchema.parse({ id: row.id, entryId: row.entry_id, kind: "entry_fee",
    money: { amountMinor: row.amount_minor, currency: row.currency }, state: row.state, needsReview: row.needs_review,
    createdAt: row.created_at.toISOString(), paymentClosesAtExclusive: row.payment_closes_at.toISOString(),
    approvalBasis: row.approval_basis, policyVersion: row.policy_version,
    allowedActions: [...(canStart ? ["start_payment" as const] : []), ...(canCheck ? ["check_payment" as const] : [])],
    blockingReasons: row.needs_review ? ["PAYMENT_UNAVAILABLE"] : row.state === "succeeded" ? [] : ["PAYMENT_UNAVAILABLE"],
  });
}

function projectSummary(row: z.infer<typeof summaryRowSchema>): OrderSummary {
  const snapshot = summarySnapshotSchema.safeParse(row.snapshot);
  const frozenContent = snapshot.success ? titleContentSchema.safeParse(snapshot.data.competition?.public_content) : null;
  const currentContent = titleContentSchema.safeParse(row.public_content);
  const competitionTitle = frozenContent?.success ? frozenContent.data.title
    : currentContent.success ? currentContent.data.title : { en: row.competition_id, ko: row.competition_id };
  const work = snapshot.success ? snapshot.data.work : undefined;
  const workTitle = work?.englishTitle?.trim() || work?.title?.trim() || "";
  const refundAmount = row.refunded_amount + row.pending_refund_amount;
  const refundSummary = row.pending_refund_amount > 0 ? { amountMinor: refundAmount, state: "pending" as const }
    : row.refunded_amount > 0 ? { amountMinor: row.refunded_amount, state: "succeeded" as const }
    : row.failed_refund_amount > 0 ? { amountMinor: row.failed_refund_amount, state: "failed" as const } : null;
  return OrderSummarySchema.parse({ id: row.id, entryId: row.entry_id, competitionTitle, workTitle, kind: "entry_fee",
    money: { amountMinor: row.amount_minor, currency: row.currency }, paymentState: row.state,
    createdAt: row.created_at.toISOString(), refundSummary });
}

export function createPaymentService(database: EntryDatabase, provider: PaymentProvider | null, now: () => Date) {
  async function applyEvidence(raw: unknown, expectedOrder?: OrderId) {
    if (provider === null) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
    const evidence = PaymentEvidenceSchema.parse(raw);
    if (evidence.merchantAccount !== provider.merchantAccount || evidence.liveMode !== provider.liveMode
      || (expectedOrder !== undefined && evidence.orderId !== expectedOrder)) throw new EntryFault("FORBIDDEN", 403);
    return database.transaction(async (db) => {
      // Event lock serializes reuse across different orders. All payment writers then lock entry -> order.
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([provider.id, provider.merchantAccount, provider.liveMode, evidence.eventId])]);
      const existing = (await db.query("SELECT event_hash FROM gyca_payment_events WHERE provider=$1 AND merchant_account=$2 AND live_mode=$3 AND event_id=$4",
        [provider.id, provider.merchantAccount, provider.liveMode, evidence.eventId])).rows[0];
      const eventHash = fingerprint(evidence);
      if (existing !== undefined) {
        if (z.object({ event_hash: z.string() }).parse(existing).event_hash !== eventHash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return { accepted: true };
      }
      const found = (await db.query("SELECT entry_id FROM gyca_orders WHERE id=$1", [evidence.orderId])).rows[0];
      if (found === undefined) throw new EntryFault("NOT_FOUND", 404);
      const entryId = z.object({ entry_id: EntryIdSchema }).parse(found).entry_id;
      const entry = entrySchema.parse((await db.query("SELECT * FROM gyca_entries WHERE id=$1 FOR UPDATE", [entryId])).rows[0]);
      const order = rowSchema.parse((await db.query("SELECT * FROM gyca_orders WHERE id=$1 FOR UPDATE", [evidence.orderId])).rows[0]);
      if (!matching(provider, order)) throw new EntryFault("FORBIDDEN", 403);
      const verifiedAt = now();
      let outcome: "applied" | "ignored" | "review" = "ignored";
      const monetaryMismatch = evidence.amountMinor !== order.amount_minor || evidence.currency !== order.currency;
      if (monetaryMismatch || evidence.requiresReview === true) outcome = "review";
      else switch (evidence.state) {
        case "succeeded": {
          const paidAt = evidence.paidAt === null ? null : new Date(evidence.paidAt);
          if (paidAt === null || paidAt > verifiedAt || paidAt < order.created_at) { outcome = "review"; break; }
          if (order.provider_payment_id !== null) {
            outcome = order.provider_payment_id === evidence.paymentId && order.paid_at?.getTime() === paidAt.getTime() ? "ignored" : "review";
            break;
          }
          // Serialize a payment identity even if a provider associates it with two order references.
          await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([provider.id, provider.merchantAccount, provider.liveMode, "payment", evidence.paymentId])]);
          const reused = (await db.query("SELECT id FROM gyca_orders WHERE provider=$1 AND merchant_account=$2 AND live_mode=$3 AND provider_payment_id=$4",
            [provider.id, provider.merchantAccount, provider.liveMode, evidence.paymentId])).rows.length > 0;
          if (reused) { outcome = "review"; break; }
          await db.query("UPDATE gyca_orders SET state='succeeded',provider_payment_id=$2,paid_at=$3 WHERE id=$1", [order.id, evidence.paymentId, paidAt]);
          const basis = order.approval_basis === "provider_paid_at" ? paidAt : verifiedAt;
          if (basis >= order.payment_closes_at || entry.status !== "submitted" || entry.submitted_at === null || order.needs_review) {
            outcome = "review"; break;
          }
          await db.query("UPDATE gyca_entries SET status='received',received_at=$2,receipt_number=$3,revision=revision+1,updated_at=$2 WHERE id=$1",
            [entry.id, verifiedAt, `GYCA-${randomUUID().toUpperCase()}`]);
          await db.query("INSERT INTO gyca_payment_outbox(key,kind,entry_id,order_id,created_at) VALUES($1,'entry_received',$2,$3,$4) ON CONFLICT DO NOTHING",
            [`entry_received:${entry.id}`, entry.id, order.id, verifiedAt]);
          outcome = "applied";
          break;
        }
        case "pending": break;
        case "failed": case "cancelled": case "expired":
          if (order.state !== "succeeded") {
            await db.query("UPDATE gyca_orders SET state=$2 WHERE id=$1", [order.id, evidence.state]);
            outcome = "applied";
          }
          break;
        default: { const impossible: never = evidence.state; return impossible; }
      }
      if (outcome === "review") {
        await db.query("UPDATE gyca_orders SET needs_review=true WHERE id=$1", [order.id]);
        await db.query("INSERT INTO gyca_payment_outbox(key,kind,entry_id,order_id,created_at) VALUES($1,'payment_review',$2,$3,$4) ON CONFLICT DO NOTHING",
          [`payment_review:${order.id}:${eventHash}`, entry.id, order.id, verifiedAt]);
      }
      await db.query("INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)",
        [provider.id, provider.merchantAccount, provider.liveMode, evidence.eventId, eventHash, order.id, JSON.stringify(evidence), verifiedAt, outcome]);
      return { accepted: true };
    });
  }
  async function reconcile(owner: string, id: OrderId) {
    const order = await database.transaction(async db => {
      const initial = await ownedOrder(db, owner, id);
      await ownedEntry(db, owner, initial.entry_id);
      const row = rowSchema.parse((await db.query("SELECT * FROM gyca_orders WHERE id=$1 FOR UPDATE", [id])).rows[0]);
      if (!matching(provider, row)) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const at = now();
      if (row.next_reconcile_at !== null && at < row.next_reconcile_at) throw new EntryFault("RATE_LIMITED", 429);
      await db.query("UPDATE gyca_orders SET next_reconcile_at=$2 WHERE id=$1", [id, new Date(at.getTime() + 10000)]);
      return row;
    });
    if (!matching(provider, order)) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
    const events = z.array(PaymentEvidenceSchema).parse(await provider.reconcile(project(order, provider, now())));
    if (events.some(event => event.orderId !== id || event.merchantAccount !== provider.merchantAccount || event.liveMode !== provider.liveMode))
      throw new EntryFault("FORBIDDEN", 403);
    for (const event of events) await applyEvidence(event, id);
    return project(await ownedOrder(database, owner, id), provider, now());
  }
  return {
    confirm: async (owner: string, id: OrderId, paymentKey: string) => {
      const reservation = await database.transaction(async (db) => {
        const initial = await ownedOrder(db, owner, id);
        const entry = await ownedEntry(db, owner, initial.entry_id);
        const order = rowSchema.parse((await db.query("SELECT * FROM gyca_orders WHERE id=$1 FOR UPDATE", [id])).rows[0]);
        if (!matching(provider, order) || provider.confirm === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
        const raw = (await db.query("SELECT * FROM gyca_payment_confirmations WHERE order_id=$1", [id])).rows[0];
        const previous = raw === undefined ? null : z.object({ payment_key: z.string(), idempotency_key: z.uuid(), replay_until: z.coerce.date() }).parse(raw);
        if (previous !== null && previous.payment_key !== paymentKey) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        if (order.state === "succeeded") return { order, key: null, replayUntil: null };
        if (order.needs_review || entry.status !== "submitted") throw new EntryFault("ENTRY_LOCKED", 409);
        // Existing ambiguous approvals after expiry are lookup-only. Never start another charge.
        if (now() >= order.payment_closes_at || (previous !== null && now() >= previous.replay_until)) {
          if (previous === null) throw new EntryFault("DEADLINE_PASSED", 409);
          return { order, key: null, replayUntil: null };
        }
        const policy = z.object({ payment_enabled: z.boolean() }).parse((await db.query(
          "SELECT payment_enabled FROM gyca_competitions WHERE id=$1 FOR SHARE", [entry.competition_id])).rows[0]);
        if (!policy.payment_enabled) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
        if (previous !== null) return { order, key: previous.idempotency_key, replayUntil: previous.replay_until };
        const key = randomUUID();
        const requestedAt = now();
        const replayUntil = new Date(requestedAt.getTime() + (provider.confirmationReplayWindowMs ?? 0));
        await db.query("INSERT INTO gyca_payment_confirmations(order_id,payment_key,idempotency_key,requested_at,replay_until) VALUES($1,$2,$3,$4,$5)",
          [id, paymentKey, key, requestedAt, replayUntil]);
        return { order, key, replayUntil };
      });
      if (!matching(provider, reservation.order) || provider.confirm === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      if (reservation.order.state === "succeeded") return project(reservation.order, provider, now());
      if (reservation.key === null || now() >= reservation.order.payment_closes_at
        || (reservation.replayUntil !== null && now() >= reservation.replayUntil)) {
        return reconcile(owner, id);
      } else {
        await applyEvidence(await provider.confirm(project(reservation.order, provider, now()), paymentKey, reservation.key), id);
      }
      return project(await ownedOrder(database, owner, id), provider, now());
    },
    create: (owner: string, entryId: EntryId, key: string) => database.transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["order-key", owner, key])]);
      const entry = await ownedEntry(db, owner, entryId);
      const previous = (await db.query("SELECT order_id FROM gyca_order_creation_keys WHERE owner_id=$1 AND key=$2", [owner, key])).rows[0];
      if (previous !== undefined) {
        const order = await ownedOrder(db, owner, z.object({ order_id: OrderIdSchema }).parse(previous).order_id);
        if (order.entry_id !== entryId) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return project(order, provider, now());
      }
      const existing = (await db.query("SELECT * FROM gyca_orders WHERE entry_id=$1", [entryId])).rows[0];
      if (existing !== undefined) {
        const row = rowSchema.parse(existing);
        await db.query("INSERT INTO gyca_order_creation_keys(owner_id,key,order_id) VALUES($1,$2,$3)", [owner, key, row.id]);
        return project(row, provider, now());
      }
      if (entry.status !== "submitted") throw new EntryFault("ENTRY_LOCKED", 409);
      if (provider === null) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const current = z.object({ payment_enabled: z.boolean(), payment_policy: z.unknown() }).parse(
        (await db.query("SELECT payment_enabled,payment_policy FROM gyca_competitions WHERE id=$1 FOR SHARE", [entry.competition_id])).rows[0]);
      const policy = policySchema.safeParse(current.payment_policy);
      if (!current.payment_enabled || !policy.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const saved = z.object({ snapshot: z.object({ competition: z.object({
        payment_closes_at: z.iso.datetime(), public_content: z.object({ fee: MoneySchema }),
      }) }) }).parse((await db.query("SELECT snapshot FROM gyca_submissions WHERE entry_id=$1", [entryId])).rows[0]);
      const terms = saved.snapshot.competition;
      const createdAt = now();
      if (createdAt >= new Date(terms.payment_closes_at)) throw new EntryFault("DEADLINE_PASSED", 409);
      if (terms.public_content.fee.amountMinor <= 0) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const id = randomUUID();
      const result = await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,
        provider,merchant_account,live_mode,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [id, entryId, terms.public_content.fee.amountMinor, terms.public_content.fee.currency, terms.payment_closes_at,
          policy.data.version, policy.data.approvalBasis, provider.id, provider.merchantAccount, provider.liveMode, createdAt]);
      await db.query("INSERT INTO gyca_order_creation_keys(owner_id,key,order_id) VALUES($1,$2,$3)", [owner, key, id]);
      return project(rowSchema.parse(result.rows[0]), provider, now());
    }),
    checkout: async (owner: string, id: OrderId) => {
      const order = await database.transaction(async (db) => {
        const row = await ownedOrder(db, owner, id);
        const entry = await ownedEntry(db, owner, row.entry_id);
        const current = rowSchema.parse((await db.query("SELECT * FROM gyca_orders WHERE id=$1 FOR UPDATE", [id])).rows[0]);
        if (!matching(provider, current) || provider.beginCheckout === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
        if (current.needs_review || current.state !== "pending" || entry.status !== "submitted") throw new EntryFault("ENTRY_LOCKED", 409);
        if (now() >= current.payment_closes_at) throw new EntryFault("DEADLINE_PASSED", 409);
        const competition = z.object({ payment_enabled: z.boolean() }).parse((await db.query(
          "SELECT payment_enabled FROM gyca_competitions WHERE id=$1 FOR SHARE", [entry.competition_id])).rows[0]);
        if (!competition.payment_enabled) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
        return current;
      });
      if (!matching(provider, order) || provider.beginCheckout === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const customerReference = createHash("sha256").update(`${provider.id}:${provider.merchantAccount}:${owner}`).digest("hex");
      const session = PaymentCheckoutSessionSchema.parse(await provider.beginCheckout(project(order, provider, now()), customerReference));
      if (session.orderId !== order.id || session.provider !== provider.id
        || session.mode !== (provider.liveMode ? "live" : "test")
        || new Date(session.expiresAt) > order.payment_closes_at || new Date(session.expiresAt) <= now())
        throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
      return session;
    },
    get: async (owner: string, id: OrderId) => project(await ownedOrder(database, owner, id), provider, now()),
    list: async (owner: string, cursor: string | null, limit: number): Promise<Page<PaymentOrder>> => {
      const rows = z.array(rowSchema).parse((await database.query(`SELECT o.* FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
        WHERE e.owner_id=$1 AND ($2::uuid IS NULL OR o.id>$2::uuid) ORDER BY o.id LIMIT $3`, [owner, cursor, limit + 1])).rows);
      const page = rows.slice(0, limit);
      return { items: page.map((r) => project(r, provider, now())), nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null };
    },
    listSummaries: async (owner: string, cursor: string | null, limit: number): Promise<Page<OrderSummary>> => {
      const rows = z.array(summaryRowSchema).parse((await database.query(`SELECT o.*,e.competition_id,s.snapshot,c.public_content,
        COALESCE((SELECT sum(r.amount_minor) FROM gyca_refunds r WHERE r.order_id=o.id AND r.state='succeeded'),0) AS refunded_amount,
        COALESCE((SELECT sum(r.amount_minor) FROM gyca_refunds r WHERE r.order_id=o.id AND r.state='pending'),0) AS pending_refund_amount,
        COALESCE((SELECT sum(r.amount_minor) FROM gyca_refunds r WHERE r.order_id=o.id AND r.state='failed'),0) AS failed_refund_amount
        FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id JOIN gyca_submissions s ON s.entry_id=e.id
        JOIN gyca_competitions c ON c.id=e.competition_id
        WHERE e.owner_id=$1 AND ($2::uuid IS NULL OR o.id>$2::uuid) ORDER BY o.id LIMIT $3`, [owner, cursor, limit + 1])).rows);
      const page = rows.slice(0, limit);
      return { items: page.map(projectSummary), nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null };
    },
    webhook: async (bytes: Uint8Array, headers: Headers) => {
      if (provider === null) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      return applyEvidence(await provider.verifyWebhook(bytes, headers));
    },
    reconcile,
  };
}
