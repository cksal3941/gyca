import { z } from "zod";
import { MoneySchema, OrderIdSchema, UtcTimestampSchema } from "./index.ts";

export const RefundRecordSchema = z.strictObject({
  id: z.uuid(), orderId: OrderIdSchema, money: MoneySchema,
  state: z.enum(["pending", "succeeded", "failed"]), reason: z.string().min(1).max(200),
  requestedAt: UtcTimestampSchema, refundedAt: UtcTimestampSchema.nullable(),
}).readonly();
export const RefundOverviewSchema = z.strictObject({
  orderId: OrderIdSchema, money: MoneySchema, refundedAmountMinor: z.number().int().nonnegative(),
  pendingAmountMinor: z.number().int().nonnegative(), remainingAmountMinor: z.number().int().nonnegative(),
  refunds: z.array(RefundRecordSchema).readonly(), allowedActions: z.array(z.literal("request_refund")).readonly(),
}).readonly();
export const RequestRefundSchema = z.strictObject({
  actionId: z.uuid(), amountMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(1).max(200),
}).readonly();
export type RefundRecord = z.infer<typeof RefundRecordSchema>;
export type RequestRefund = z.infer<typeof RequestRefundSchema>;
