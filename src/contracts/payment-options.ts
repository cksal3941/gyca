import { z } from "zod";
import { EntryIdSchema, MoneySchema, LocalizedTextSchema, BLOCKING_REASONS } from "./index.ts";

export const PaymentOptionsSchema = z.object({
  entryId: EntryIdSchema, country: z.string().nullable(), money: MoneySchema.nullable(),
  routes: z.array(z.object({ id: z.string(), policyToken: z.string().regex(/^[a-f0-9]{64}$/), label: LocalizedTextSchema,
    mode: z.enum(["test", "live"]), refundNotice: LocalizedTextSchema,
  }).readonly()).readonly(),
  allowedActions: z.array(z.literal("create_order")).readonly(),
  blockingReasons: z.array(z.enum(BLOCKING_REASONS)).readonly(),
}).readonly();
export type PaymentOptions = z.infer<typeof PaymentOptionsSchema>;
export const SelectPaymentRouteSchema = z.strictObject({
  routeId: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  policyToken: z.string().regex(/^[a-f0-9]{64}$/),
  acceptedRefundNotice: z.literal(true),
}).readonly();
export type SelectPaymentRoute = z.infer<typeof SelectPaymentRouteSchema>;
