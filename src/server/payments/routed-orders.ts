import { z } from "zod";
import { EntryIdSchema, MoneySchema } from "../../contracts/index.ts";
import type { SelectPaymentRoute } from "../../contracts/payment-options.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { PaymentRoutingPolicySchema, routingToken } from "./options.ts";
import { createPaymentService } from "./service.ts";
import type { PaymentProvider } from "./provider.ts";

export function createRoutedOrders(database: EntryDatabase,
  runtime: { readonly providers: readonly PaymentProvider[]; readonly now: () => Date }) {
  return async (actor: string, target: { readonly entryId: string; readonly key: string }, input: SelectPaymentRoute) =>
    database.transaction(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify(["order-key", actor, target.key])]);
      const raw = (await db.query("SELECT id,competition_id FROM gyca_entries WHERE id=$1 AND owner_id=$2 FOR UPDATE", [target.entryId, actor])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const entry = z.object({ id: EntryIdSchema, competition_id: z.string() }).parse(raw);
      const existing = (await db.query(`SELECT o.provider,o.merchant_account,o.live_mode,r.route_id,r.policy_token
        FROM gyca_orders o LEFT JOIN gyca_order_routes r ON r.order_id=o.id WHERE o.entry_id=$1`, [entry.id])).rows[0];
      // Reuse the surrounding transaction so order and route evidence commit together.
      const atomic: EntryDatabase = { query: (sql, values) => db.query(sql, values), transaction: run => run(db) };
      if (existing !== undefined) {
        const saved = z.object({ provider: z.string(), merchant_account: z.string(), live_mode: z.boolean(),
          route_id: z.string().nullable(), policy_token: z.string().nullable() }).parse(existing);
        if (saved.route_id !== input.routeId || saved.policy_token !== input.policyToken) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        const provider = runtime.providers.find(p => p.id === saved.provider && p.merchantAccount === saved.merchant_account && p.liveMode === saved.live_mode) ?? null;
        return createPaymentService(atomic, provider, runtime.now).create(actor, entry.id, target.key);
      }
      const policyRow = z.object({ payment_routing: z.unknown() }).parse((await db.query(
        "SELECT payment_routing FROM gyca_competitions WHERE id=$1 FOR SHARE", [entry.competition_id])).rows[0]);
      const policy = PaymentRoutingPolicySchema.safeParse(policyRow.payment_routing);
      if (!policy.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      if (routingToken(policy.data) !== input.policyToken) throw new EntryFault("CONSENT_REQUIRED", 409);
      const route = policy.data.routes.find(r => r.id === input.routeId && r.enabled);
      if (route === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 409);
      const saved = z.object({ snapshot: z.object({ participant: z.object({ residenceCountry: z.string() }),
        competition: z.object({ public_content: z.object({ fee: MoneySchema }) }) }) }).safeParse(
        (await db.query("SELECT snapshot FROM gyca_submissions WHERE entry_id=$1", [entry.id])).rows[0]);
      if (!saved.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      if (!route.countries.includes(saved.data.snapshot.participant.residenceCountry) || route.currency !== saved.data.snapshot.competition.public_content.fee.currency)
        throw new EntryFault("PAYMENT_UNAVAILABLE", 409);
      const provider = runtime.providers.find(p => p.id === route.provider && p.merchantAccount === route.merchantAccount && p.liveMode === route.liveMode);
      if (provider === undefined) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const order = await createPaymentService(atomic, provider, runtime.now).create(actor, entry.id, target.key);
      await db.query(`INSERT INTO gyca_order_routes(order_id,route_id,policy_token,terms,actor_id,accepted_at)
        VALUES($1,$2,$3,$4::jsonb,$5,$6)`, [order.id, route.id, input.policyToken,
        JSON.stringify({ policyVersion: policy.data.version, route, acceptedRefundNotice: true }), actor, runtime.now()]);
      return order;
    });
}
