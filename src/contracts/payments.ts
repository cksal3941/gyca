import { z } from "zod";
import { OrderIdSchema, EntryIdSchema, MoneySchema, PAYMENT_STATES, BLOCKING_REASONS, UtcTimestampSchema, CurrencySchema } from "./index.ts";

const httpsUrl = z.url().refine((value) => new URL(value).protocol === "https:", "Checkout URL must use HTTPS");

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
  launch: z.discriminatedUnion("kind", [
    // Provider-hosted page: the browser navigates to the HTTPS URL.
    z.strictObject({
      kind: z.literal("redirect"),
      url: httpsUrl,
    }).readonly(),
    // Toss Payments browser SDK (js.tosspayments.com/v2/standard). The browser calls
    // TossPayments(clientKey).payment({customerKey}).requestPayment(...) with exactly these
    // server-fixed values; the amount is the immutable order amount in provider units.
    z.strictObject({
      kind: z.literal("tosspayments_sdk"),
      clientKey: z.string().regex(/^(test|live)_(gck|ck)_[A-Za-z0-9]+$/),
      customerKey: z.string().min(2).max(50).regex(/^[A-Za-z0-9\-_=.@]+$/).refine((v) => /[-_=.@]/.test(v)),
      orderName: z.string().min(1).max(100),
      amount: z.strictObject({ currency: CurrencySchema, value: z.number().nonnegative().finite() }).readonly(),
      // CARD: domestic/foreign cards billed in KRW. FOREIGN_EASY_PAY: PayPal billed in USD, which
      // Toss requires to carry the buyer country and the purchased item for seller protection.
      method: z.enum(["CARD", "FOREIGN_EASY_PAY"]),
      foreignEasyPay: z.strictObject({
        provider: z.literal("PAYPAL"),
        country: z.string().regex(/^[A-Z]{2}$/),
        products: z.array(z.strictObject({ name: z.string().min(1).max(100), quantity: z.number().int().positive(),
          unitAmount: z.number().nonnegative().finite(), currency: CurrencySchema, description: z.string().min(1).max(200) }).readonly()).min(1).readonly(),
      }).readonly().optional(),
      successUrl: httpsUrl,
      failUrl: httpsUrl,
    }).refine((v) => (v.method === "FOREIGN_EASY_PAY") === (v.foreignEasyPay !== undefined), "PayPal launch requires foreignEasyPay").readonly(),
  ]),
}).readonly();
export type PaymentOrder = z.infer<typeof PaymentOrderSchema>;
export type PaymentCheckoutSession = z.infer<typeof PaymentCheckoutSessionSchema>;
