import { z } from "zod";
import { OrderIdSchema, EntryIdSchema, MoneySchema, PAYMENT_STATES, ERROR_CODES, UtcTimestampSchema } from "./index.ts";

export const PAYMENT_REVIEW_REASONS = ["AMOUNT_MISMATCH", "CURRENCY_MISMATCH", "PROVIDER_REVIEW_REQUIRED",
  "PAID_AT_AFTER_VERIFICATION", "PAID_AT_BEFORE_ORDER", "PAYMENT_EVIDENCE_CONFLICT", "PAYMENT_IDENTITY_REUSED",
  "APPROVED_AFTER_DEADLINE", "ENTRY_STATE_CONFLICT", "LEGACY_UNKNOWN"] as const;

export const PaymentReviewSchema = z.object({
  orderId: OrderIdSchema, entryId: EntryIdSchema, money: MoneySchema,
  state: z.enum(PAYMENT_STATES), needsReview: z.boolean(), reviewReasons: z.array(z.enum(PAYMENT_REVIEW_REASONS)).readonly(),
  reviewedAt: UtcTimestampSchema.nullable(),
  recovery: z.object({ state: z.enum(["pending", "running", "completed", "stalled"]),
    attempts: z.number().int().nonnegative(), updatedAt: UtcTimestampSchema,
    lastErrorCode: z.enum(ERROR_CODES).nullable(), nextAttemptAt: UtcTimestampSchema.nullable(),
    leaseExpiresAt: UtcTimestampSchema.nullable() }).readonly().nullable(),
  allowedActions: z.array(z.enum(["requeue_recovery", "accept_late_payment"])).readonly(),
}).superRefine((value, context) => {
  if (value.needsReview === (value.reviewReasons.length === 0))
    context.addIssue({ code: "custom", path: ["reviewReasons"], message: "Review reasons must match needsReview" });
}).readonly();
export const RequeueRecoveryRequestSchema = z.strictObject({
  actionId: z.uuid(), reason: z.string().trim().min(1).max(1000),
  expectedUpdatedAt: UtcTimestampSchema,
}).readonly();
export type RequeueRecoveryRequest = z.infer<typeof RequeueRecoveryRequestSchema>;
export const AcceptLatePaymentRequestSchema = z.strictObject({
  actionId: z.uuid(), reason: z.string().trim().min(1).max(1000), expectedReviewedAt: UtcTimestampSchema,
}).readonly();
export type AcceptLatePaymentRequest = z.infer<typeof AcceptLatePaymentRequestSchema>;
export const PaymentAdminActionSchema = z.object({
  id: z.uuid(), actorId: z.string(), action: z.enum(["requeue_recovery", "accept_late_payment"]),
  reason: z.string(), createdAt: UtcTimestampSchema,
}).readonly();
export const AcceptLatePaymentResultSchema = z.strictObject({
  actionId: z.uuid(), outcome: z.literal("receipt_issued"), entryId: EntryIdSchema,
  receiptNumber: z.string().min(1), receivedAt: UtcTimestampSchema,
}).readonly();
export type PaymentReview = z.infer<typeof PaymentReviewSchema>;
export type PaymentAdminAction = z.infer<typeof PaymentAdminActionSchema>;
