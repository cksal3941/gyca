import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { z } from "zod";
import { EntryFault } from "../entries/errors.ts";
import { PaymentEvidenceSchema, RefundEvidenceSchema } from "./provider.ts";
import type { PaymentProvider } from "./provider.ts";
import type { PaymentOrder } from "../../contracts/payments.ts";

const configSchema = z.strictObject({
  secretKey: z.string().regex(/^(test|live)_(gsk|sk)_[A-Za-z0-9]+$/),
  merchantAccount: z.string().min(1).max(14), liveMode: z.boolean(),
  currencyTerms: z.strictObject({ currency: z.literal("EUR"), amountUnit: z.enum(["major", "minor"]),
    approvalReference: z.string().trim().min(1) }),
}).refine((c) => c.secretKey.startsWith(c.liveMode ? "live_" : "test_"));
export type TossConfig = z.infer<typeof configSchema>;
export function configuredTossProvider(env: Readonly<Record<string, string | undefined>>): PaymentProvider | null {
  if (env.GYCA_PAYMENT_PROVIDER !== "tosspayments-test") return null;
  const parsed = configSchema.safeParse({ secretKey: env.TOSS_TEST_SECRET_KEY, merchantAccount: env.TOSS_TEST_MID,
    liveMode: false, currencyTerms: { currency: "EUR", amountUnit: env.TOSS_EUR_AMOUNT_UNIT,
      approvalReference: env.TOSS_EUR_APPROVAL_REFERENCE } });
  return parsed.success ? createTossProvider(parsed.data) : null;
}
export interface TossTransport {
  (path: string, body?: Readonly<Record<string, unknown>>, idempotencyKey?: string): Promise<{ readonly status: number; readonly body: unknown }>;
}

export function createTossTransport(secretKey: string, request: typeof httpsRequest = httpsRequest): TossTransport {
  return (path, body, idempotencyKey) => new Promise((resolve, reject) => {
    const fail = () => reject(new EntryFault("PAYMENT_UNAVAILABLE", 503));
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/json" };
    if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;
    if (payload !== undefined) headers["Content-Length"] = Buffer.byteLength(payload).toString();
    const req = request({ protocol: "https:", hostname: "api.tosspayments.com", port: 443,
      path, method: payload === undefined ? "GET" : "POST", headers, signal: AbortSignal.timeout(10000) }, (response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 262144) { response.destroy(); req.destroy(); fail(); return; }
        chunks.push(chunk);
      });
      response.on("error", fail);
      response.on("end", () => {
        try { resolve({ status: response.statusCode ?? 502, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch (error) { if (error instanceof SyntaxError) fail(); else reject(error); }
      });
    });
    req.on("error", fail);
    req.end(payload);
  });
}

const paymentSchema = z.object({
  paymentKey: z.string().min(1).max(200), orderId: z.uuid(), mId: z.string(), type: z.literal("NORMAL"),
  currency: z.string(), totalAmount: z.number().finite().nonnegative(),
  status: z.enum(["READY", "IN_PROGRESS", "WAITING_FOR_DEPOSIT", "DONE", "CANCELED", "PARTIAL_CANCELED", "ABORTED", "EXPIRED"]),
  approvedAt: z.iso.datetime({ offset: true }).nullable(), lastTransactionKey: z.string().nullable(),
  cancels: z.array(z.object({ cancelAmount: z.number().finite().positive(), transactionKey: z.string().min(1).max(255),
    canceledAt: z.iso.datetime({ offset: true }) })).nullable().optional(),
});

function amountMinor(amount: number, unit: "major" | "minor"): number {
  // Decimal text conversion rejects fractions of a cent rather than silently rounding them.
  const parts = String(amount).split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";
  if (!/^\d+$/.test(whole) || fraction.length > (unit === "major" ? 2 : 0)) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
  const minor = unit === "major" ? Number(`${whole}${fraction.padEnd(2, "0")}`) : amount;
  if (!Number.isSafeInteger(minor)) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
  return minor;
}

export function createTossProvider(input: TossConfig, injectedTransport?: TossTransport): PaymentProvider {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
  const config = parsed.data;
  const transport = injectedTransport ?? createTossTransport(config.secretKey);
  async function call(path: string, body?: Readonly<Record<string, unknown>>, key?: string) {
    const response = await transport(path, body, key);
    if (response.status < 200 || response.status >= 300) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
    const result = paymentSchema.safeParse(response.body);
    if (!result.success) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
    if (result.data.mId !== config.merchantAccount || result.data.currency !== config.currencyTerms.currency)
      throw new EntryFault("FORBIDDEN", 403);
    return result.data;
  }
  function normalize(payment: z.infer<typeof paymentSchema>) {
    const amount = amountMinor(payment.totalAmount, config.currencyTerms.amountUnit);
    const paidAt = payment.approvedAt === null ? null : new Date(payment.approvedAt).toISOString();
    const fields = { paymentId: payment.paymentKey, orderId: payment.orderId, merchantAccount: payment.mId,
      liveMode: config.liveMode, currency: payment.currency, amountMinor: amount, paidAt };
    const eventId = createHash("sha256").update(JSON.stringify({ ...fields, status: payment.status, transaction: payment.lastTransactionKey })).digest("hex");
    switch (payment.status) {
      case "DONE": return PaymentEvidenceSchema.parse({ ...fields, eventId, state: "succeeded" });
      case "READY": case "IN_PROGRESS": case "WAITING_FOR_DEPOSIT":
        return PaymentEvidenceSchema.parse({ ...fields, eventId, state: "pending" });
      case "ABORTED": return PaymentEvidenceSchema.parse({ ...fields, eventId, state: "failed" });
      case "EXPIRED": return PaymentEvidenceSchema.parse({ ...fields, eventId, state: "expired" });
      case "CANCELED": case "PARTIAL_CANCELED":
        return PaymentEvidenceSchema.parse({ ...fields, eventId, state: "cancelled", requiresReview: true });
      default: { const impossible: never = payment.status; return impossible; }
    }
  }
  async function lookup(orderId: string) {
    const payment = await call(`/v1/payments/orders/${encodeURIComponent(orderId)}`);
    if (payment.orderId !== orderId) throw new EntryFault("FORBIDDEN", 403);
    return normalize(payment);
  }
  return {
    id: "tosspayments", merchantAccount: config.merchantAccount, liveMode: config.liveMode,
    confirmationReplayWindowMs: 15 * 86400000,
    confirm: async (order: PaymentOrder, paymentKey: string, key: string) => {
      if (order.money.currency !== config.currencyTerms.currency) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const amount = config.currencyTerms.amountUnit === "major" ? order.money.amountMinor / 100 : order.money.amountMinor;
      if (amountMinor(amount, config.currencyTerms.amountUnit) !== order.money.amountMinor) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const payment = await call("/v1/payments/confirm", { paymentKey, orderId: order.id, amount }, key);
      if (payment.orderId !== order.id || payment.paymentKey !== paymentKey) throw new EntryFault("FORBIDDEN", 403);
      return normalize(payment);
    },
    refund: async (order: PaymentOrder, paymentKey: string, refundMinor: number, reason: string, key: string) => {
      if (order.money.currency !== config.currencyTerms.currency) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const cancelAmount = config.currencyTerms.amountUnit === "major" ? refundMinor / 100 : refundMinor;
      if (amountMinor(cancelAmount, config.currencyTerms.amountUnit) !== refundMinor) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const payment = await call(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason: reason, cancelAmount }, key);
      if (payment.orderId !== order.id || payment.paymentKey !== paymentKey) throw new EntryFault("FORBIDDEN", 403);
      const cancellation = payment.cancels?.at(-1);
      if (cancellation === undefined || amountMinor(cancellation.cancelAmount, config.currencyTerms.amountUnit) !== refundMinor)
        throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
      return RefundEvidenceSchema.parse({ refundId: cancellation.transactionKey, orderId: order.id, paymentId: paymentKey,
        amountMinor: refundMinor, currency: payment.currency, refundedAt: new Date(cancellation.canceledAt).toISOString() });
    },
    reconcile: async (order) => [await lookup(order.id)],
    verifyWebhook: async (bytes) => {
      let value: unknown;
      try { value = JSON.parse(Buffer.from(bytes).toString("utf8")); }
      catch (error) { if (error instanceof SyntaxError) throw new EntryFault("VALIDATION_FAILED", 422); throw error; }
      const notification = z.object({ eventType: z.literal("PAYMENT_STATUS_CHANGED"),
        data: z.object({ orderId: z.uuid(), paymentKey: z.string().min(1).max(200) }) }).safeParse(value);
      if (!notification.success) throw new EntryFault("VALIDATION_FAILED", 422);
      const verified = await lookup(notification.data.data.orderId);
      if (verified.paymentId !== notification.data.data.paymentKey) throw new EntryFault("FORBIDDEN", 403);
      return verified;
    },
  };
}
