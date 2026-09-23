import { z } from "zod";
import { createHash } from "node:crypto";
import { EntryIdSchema, MoneySchema, LocalizedTextSchema, ENTRY_STATUSES } from "../../contracts/index.ts";
import { PaymentOptionsSchema } from "../../contracts/payment-options.ts";
import type { PaymentOptions } from "../../contracts/payment-options.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { PaymentProvider } from "./provider.ts";

import { PaymentRoutingPolicySchema } from "../../contracts/payment-policy.ts";
export { PaymentRoutingPolicySchema } from "../../contracts/payment-policy.ts";

export function routingToken(policy: z.infer<typeof PaymentRoutingPolicySchema>) {
  return createHash("sha256").update(JSON.stringify(policy)).digest("hex");
}

const rowSchema = z.object({
  status: z.enum(ENTRY_STATUSES), payment_enabled: z.boolean(), payment_routing: z.unknown(), snapshot: z.unknown(),
  order_id: z.string().nullable(),
});
const snapshotSchema = z.object({ participant: z.object({ residenceCountry: z.string().regex(/^[A-Z]{2}$/) }),
  competition: z.object({ payment_closes_at: z.iso.datetime(), public_content: z.object({ fee: MoneySchema }) }),
});
type ProviderIdentity = Pick<PaymentProvider, "id" | "merchantAccount" | "liveMode">;

export function createPaymentOptions(database: EntryDatabase,
  runtime: { readonly providers: readonly ProviderIdentity[]; readonly now: () => Date }) {
  return async (owner: string, entryId: string): Promise<PaymentOptions> => {
    const raw = (await database.query(`SELECT e.status,c.payment_enabled,c.payment_routing,s.snapshot,o.id AS order_id
      FROM gyca_entries e JOIN gyca_competitions c ON c.id=e.competition_id
      LEFT JOIN gyca_submissions s ON s.entry_id=e.id LEFT JOIN gyca_orders o ON o.entry_id=e.id
      WHERE e.id=$1 AND e.owner_id=$2`, [entryId, owner])).rows[0];
    if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
    const row = rowSchema.parse(raw);
    const snapshot = snapshotSchema.safeParse(row.snapshot);
    const base = { entryId: EntryIdSchema.parse(entryId), country: snapshot.success ? snapshot.data.participant.residenceCountry : null,
      money: snapshot.success ? snapshot.data.competition.public_content.fee : null, routes: [], allowedActions: [] };
    if (row.status !== "submitted") return PaymentOptionsSchema.parse({ ...base, blockingReasons: ["ENTRY_LOCKED"] });
    if (!snapshot.success) return PaymentOptionsSchema.parse({ ...base, blockingReasons: ["POLICY_NOT_CONFIGURED"] });
    // Any existing order remains bound to its original provider, including failed or ambiguous payments.
    if (row.order_id !== null) return PaymentOptionsSchema.parse({ ...base, blockingReasons: ["ENTRY_LOCKED"] });
    if (runtime.now() >= new Date(snapshot.data.competition.payment_closes_at))
      return PaymentOptionsSchema.parse({ ...base, blockingReasons: ["DEADLINE_PASSED"] });
    const policy = PaymentRoutingPolicySchema.safeParse(row.payment_routing);
    if (!row.payment_enabled || !policy.success || snapshot.data.competition.public_content.fee.amountMinor <= 0)
      return PaymentOptionsSchema.parse({ ...base, blockingReasons: ["POLICY_NOT_CONFIGURED"] });
    const routes = policy.data.routes.filter(route => route.enabled && route.countries.includes(snapshot.data.participant.residenceCountry)
      && route.currency === snapshot.data.competition.public_content.fee.currency
      && runtime.providers.some(provider => provider.id === route.provider && provider.merchantAccount === route.merchantAccount && provider.liveMode === route.liveMode))
      .map(route => ({ id: route.id, policyToken: routingToken(policy.data), label: LocalizedTextSchema.parse(route.label), mode: route.liveMode ? "live" : "test", refundNotice: route.refundNotice }));
    return PaymentOptionsSchema.parse({ ...base, routes,
      allowedActions: routes.length > 0 ? ["create_order"] : [],
      blockingReasons: routes.length > 0 ? [] : ["PAYMENT_UNAVAILABLE"] });
  };
}
