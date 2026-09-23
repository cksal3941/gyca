import { z } from "zod";
import { PAYMENT_STATES, UtcTimestampSchema } from "../../contracts/index.ts";
import type { PaymentOrder } from "../../contracts/payments.ts";
import type { PaymentCheckoutSession } from "../../contracts/payments.ts";

export const PaymentEvidenceSchema = z.strictObject({
  eventId: z.string().min(1).max(255), paymentId: z.string().min(1).max(255), orderId: z.uuid(),
  merchantAccount: z.string().min(1).max(255), liveMode: z.boolean(),
  state: z.enum(PAYMENT_STATES), amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().min(1).max(10), paidAt: UtcTimestampSchema.nullable(),
  requiresReview: z.boolean().optional(),
}).refine((e) => e.state !== "succeeded" || e.paidAt !== null).readonly();
export type PaymentEvidence = z.infer<typeof PaymentEvidenceSchema>;
export const RefundEvidenceSchema = z.strictObject({
  refundId: z.string().min(1).max(255), orderId: z.uuid(), paymentId: z.string().min(1).max(255),
  amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency: z.string().min(1).max(10),
  refundedAt: UtcTimestampSchema,
}).readonly();
export type RefundEvidence = z.infer<typeof RefundEvidenceSchema>;

export interface PaymentProvider {
  readonly id: string;
  readonly merchantAccount: string;
  readonly liveMode: boolean;
  readonly confirm?: (order: PaymentOrder, paymentKey: string, idempotencyKey: string) => Promise<unknown>;
  readonly confirmationReplayWindowMs?: number;
  readonly refund?: (order: PaymentOrder, paymentId: string, amountMinor: number, reason: string,
    idempotencyKey: string) => Promise<unknown>;
  // Creates or reuses a hosted checkout for this immutable order. Implementations must use the
  // order ID as their idempotency reference and return only a browser-safe HTTPS redirect URL.
  readonly beginCheckout?: (order: PaymentOrder, customerReference: string) => Promise<PaymentCheckoutSession>;
  // Authenticate original webhook bytes before normalization; where the provider does not sign a
  // notification, use an authenticated provider lookup instead of trusting notification fields.
  readonly verifyWebhook: (bytes: Uint8Array, headers: Headers) => Promise<unknown>;
  // Authenticated provider lookup; never use browser success parameters as evidence.
  // Stable event IDs and canonical data must match webhook normalization for the same observation.
  readonly reconcile: (order: PaymentOrder) => Promise<readonly unknown[]>;
}
