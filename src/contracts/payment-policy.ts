import { z } from "zod";

const text = z.string().trim().min(1).max(10000);
const notice = z.strictObject({ en: text, ko: text }).readonly();
export const PaymentPolicySchema = z.strictObject({ version: z.string().trim().min(1),
  approvalBasis: z.enum(["provider_paid_at", "server_verified_at"]) });
export const PaymentRoutingPolicySchema = z.strictObject({
  version: text,
  routes: z.array(z.strictObject({
    id: z.string().regex(/^[a-z0-9_-]{1,64}$/), enabled: z.boolean(),
    provider: text, merchantAccount: text, liveMode: z.boolean(),
    countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).readonly(),
    currency: z.literal("EUR"), approvalReference: text, label: notice, refundNotice: notice,
  }).readonly()).max(20).readonly(),
}).refine(value => new Set(value.routes.map(route => route.id)).size === value.routes.length).readonly();
export const UpdatePaymentPolicySchema = z.strictObject({ revision: z.number().int().positive(),
  policy: PaymentPolicySchema, routing: PaymentRoutingPolicySchema }).readonly();
export const PaymentPolicyDetailSchema = z.strictObject({ competitionId: z.string(), revision: z.number().int().positive(),
  policy: PaymentPolicySchema.nullable(), routing: PaymentRoutingPolicySchema.nullable() }).readonly();
