import { z } from "zod";
import { OrderIdSchema, EntryIdSchema, MoneySchema, PAYMENT_STATES, BLOCKING_REASONS, UtcTimestampSchema } from "./index.ts";

export const PaymentOrderSchema = z.object({
  id: OrderIdSchema, entryId: EntryIdSchema, kind: z.literal("entry_fee"), money: MoneySchema,
  state: z.enum(PAYMENT_STATES), needsReview: z.boolean(), createdAt: UtcTimestampSchema,
  paymentClosesAtExclusive: UtcTimestampSchema,
  approvalBasis: z.enum(["provider_paid_at", "server_verified_at"]), policyVersion: z.string(),
  allowedActions: z.array(z.enum(["start_payment", "check_payment"])).readonly(),
  blockingReasons: z.array(z.enum(BLOCKING_REASONS)).readonly(),
}).readonly();
export const EmptyPaymentRequestSchema = z.strictObject({}).readonly();
export const ConfirmPaymentRequestSchema = z.strictObject({
  paymentKey: z.string().min(1).max(200).regex(/^[\x21-\x7e]+$/),
}).readonly();
export const PaymentCheckoutSessionSchema = z.strictObject({
  orderId: OrderIdSchema,
  provider: z.string().min(1).max(64),
  mode: z.enum(["test", "live"]),
  expiresAt: UtcTimestampSchema,
  launch: z.strictObject({
    kind: z.literal("redirect"),
    url: z.url().refine((value) => new URL(value).protocol === "https:", "Checkout URL must use HTTPS"),
  }).readonly(),
}).readonly();
export type PaymentOrder = z.infer<typeof PaymentOrderSchema>;
export type PaymentCheckoutSession = z.infer<typeof PaymentCheckoutSessionSchema>;
