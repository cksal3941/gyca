import { createHash } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { z } from "zod";
import { CURRENCY_EXPONENT } from "../../contracts/index.ts";
import { EntryFault } from "../entries/errors.ts";
import { PaymentEvidenceSchema, RefundEvidenceSchema } from "./provider.ts";
import type { PaymentProvider } from "./provider.ts";
import { PaymentCheckoutSessionSchema } from "../../contracts/payments.ts";
import type { PaymentCheckoutSession, PaymentOrder } from "../../contracts/payments.ts";

// Toss Payments (https://docs.tosspayments.com). Documented currencies: KRW for the standard payment
// window, USD only for overseas PayPal easy pay. EUR is not billable through Toss, so an EUR order
// is refused instead of being converted.
const TOSS_CURRENCIES = ["KRW", "USD"] as const;
// One Toss MID bills exactly one currency. CARD windows (domestic and foreign cards) bill KRW;
// FOREIGN_EASY_PAY (PayPal) bills USD and lives on its own MID with its own key pair.
const TOSS_METHODS = ["CARD", "FOREIGN_EASY_PAY"] as const;
const secretKeyPattern = /^(test|live)_(gsk|sk)_[A-Za-z0-9]+$/;
const clientKeyPattern = /^(test|live)_(gck|ck)_[A-Za-z0-9]+$/;
const configSchema = z.strictObject({
  secretKey: z.string().regex(secretKeyPattern),
  // Browser SDK key. Without it the server still verifies approvals and webhooks but cannot launch
  // a payment window, so orders never advertise start_payment.
  clientKey: z.string().regex(clientKeyPattern).optional(),
  merchantAccount: z.string().min(1).max(14), liveMode: z.boolean(),
  currency: z.enum(TOSS_CURRENCIES),
  method: z.enum(TOSS_METHODS).default("CARD"),
  // Public HTTPS origin of this site; success/fail return URLs are built from it.
  siteOrigin: z.url().refine((value) => new URL(value).protocol === "https:").optional(),
  // Operator's reference to the merchant contract that covers this currency and mode. Required for
  // live mode so that a live key alone never opens real billing.
  approvalReference: z.string().trim().min(1).optional(),
}).refine((c) => c.secretKey.startsWith(c.liveMode ? "live_" : "test_"), "Secret key does not match mode")
  .refine((c) => c.clientKey === undefined || c.clientKey.startsWith(c.liveMode ? "live_" : "test_"), "Client key does not match mode")
  .refine((c) => !c.liveMode || c.approvalReference !== undefined, "Live mode requires a contract reference")
  .refine((c) => (c.method === "FOREIGN_EASY_PAY") === (c.currency === "USD"), "PayPal bills USD; card windows bill KRW");
export type TossConfig = z.input<typeof configSchema>;

// GYCA_PAYMENT_PROVIDER=tosspayments with TOSS_MODE=test|live. The legacy value tosspayments-test
// still activates test mode with the TOSS_TEST_* variables. Live mode needs the explicit TOSS_MODE=live
// plus live_ keys plus TOSS_APPROVAL_REFERENCE; nothing is inferred from a key prefix alone.
// Two merchant accounts can be active at once: the card MID (TOSS_*) billing KRW and the PayPal
// MID (TOSS_PAYPAL_*) billing USD. Each is a separate provider with its own identity.
export function configuredTossProviders(env: Readonly<Record<string, string | undefined>>): readonly PaymentProvider[] {
  const choice = env.GYCA_PAYMENT_PROVIDER;
  if (choice !== "tosspayments" && choice !== "tosspayments-test") return [];
  const mode = choice === "tosspayments-test" ? "test" : env.TOSS_MODE;
  if (mode !== "test" && mode !== "live") return [];
  const blank = (value: string | undefined) => value === undefined || value.trim() === "" ? undefined : value.trim();
  const shared = {
    liveMode: mode === "live",
    // Only an HTTPS public origin can host the Toss return URLs; otherwise the window stays unavailable.
    siteOrigin: blank(env.BETTER_AUTH_URL)?.startsWith("https://") ? blank(env.BETTER_AUTH_URL) : undefined,
    approvalReference: blank(env.TOSS_APPROVAL_REFERENCE),
  };
  const card = configSchema.safeParse({ ...shared, method: "CARD",
    secretKey: blank(env.TOSS_SECRET_KEY) ?? blank(env.TOSS_TEST_SECRET_KEY),
    clientKey: blank(env.TOSS_CLIENT_KEY),
    merchantAccount: blank(env.TOSS_MID) ?? blank(env.TOSS_TEST_MID),
    currency: blank(env.TOSS_CURRENCY) ?? "KRW",
  });
  const paypalConfigured = [env.TOSS_PAYPAL_MID, env.TOSS_PAYPAL_SECRET_KEY, env.TOSS_PAYPAL_CLIENT_KEY].some((v) => blank(v) !== undefined);
  const paypal = paypalConfigured ? configSchema.safeParse({ ...shared, method: "FOREIGN_EASY_PAY", currency: "USD",
    secretKey: blank(env.TOSS_PAYPAL_SECRET_KEY), clientKey: blank(env.TOSS_PAYPAL_CLIENT_KEY),
    merchantAccount: blank(env.TOSS_PAYPAL_MID) }) : null;
  const providers: PaymentProvider[] = [];
  if (card.success) providers.push(createTossProvider(card.data));
  // A partially configured PayPal MID is an operator error: refuse to run with only the card MID.
  if (paypal !== null) { if (!paypal.success) return []; providers.push(createTossProvider(paypal.data)); }
  if (providers.length === 2 && providers[0].merchantAccount === providers[1].merchantAccount) return [];
  return providers;
}
export function configuredTossProvider(env: Readonly<Record<string, string | undefined>>): PaymentProvider | null {
  return configuredTossProviders(env)[0] ?? null;
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
    canceledAt: z.iso.datetime({ offset: true }), cancelStatus: z.string().optional() })).nullable().optional(),
});

// Toss amounts are in the currency's major unit (KRW whole won, USD dollars with cents). Decimal text
// conversion rejects more fractional digits than the currency allows rather than silently rounding.
function amountMinor(amount: number, exponent: 0 | 2): number {
  const parts = String(amount).split(".");
  const whole = parts[0] ?? "";
  const fraction = parts[1] ?? "";
  if (!/^\d+$/.test(whole) || fraction.length > exponent) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
  const minor = exponent === 0 ? amount : Number(`${whole}${fraction.padEnd(exponent, "0")}`);
  if (!Number.isSafeInteger(minor)) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
  return minor;
}
function providerAmount(minor: number, exponent: 0 | 2): number {
  const amount = exponent === 0 ? minor : minor / 10 ** exponent;
  if (amountMinor(amount, exponent) !== minor) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
  return amount;
}

export const TOSS_CHECKOUT_TTL_MS = 30 * 60000;

export function createTossProvider(input: TossConfig, injectedTransport?: TossTransport, now: () => Date = () => new Date()): PaymentProvider {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
  const config = parsed.data;
  const exponent = CURRENCY_EXPONENT[config.currency];
  const transport = injectedTransport ?? createTossTransport(config.secretKey);
  async function call(path: string, body?: Readonly<Record<string, unknown>>, key?: string) {
    const response = await transport(path, body, key);
    if (response.status < 200 || response.status >= 300) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
    const result = paymentSchema.safeParse(response.body);
    if (!result.success) throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
    if (result.data.mId !== config.merchantAccount || result.data.currency !== config.currency)
      throw new EntryFault("FORBIDDEN", 403);
    return result.data;
  }
  function normalize(payment: z.infer<typeof paymentSchema>) {
    const amount = amountMinor(payment.totalAmount, exponent);
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
  function requireCurrency(order: PaymentOrder) {
    if (order.money.currency !== config.currency) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
  }
  const { clientKey, siteOrigin } = config;
  // The browser SDK launch is only offered when both the client key and the public origin are configured.
  const beginCheckout = clientKey === undefined || siteOrigin === undefined ? undefined
    : async (order: PaymentOrder, customerReference: string, context?: { readonly buyerCountry?: string | null }): Promise<PaymentCheckoutSession> => {
      requireCurrency(order);
      const value = providerAmount(order.money.amountMinor, exponent);
      // PayPal needs the buyer's country and the purchased item (seller protection); the entry fee is
      // a digital service, so no shipping block is sent.
      const buyerCountry = context?.buyerCountry ?? null;
      if (config.method === "FOREIGN_EASY_PAY" && (buyerCountry === null || !/^[A-Z]{2}$/.test(buyerCountry)))
        throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const foreignEasyPay = config.method === "FOREIGN_EASY_PAY" ? { provider: "PAYPAL" as const, country: buyerCountry as string,
        products: [{ name: "GYCA Entry Fee", quantity: 1, unitAmount: value, currency: config.currency,
          description: "Global Youth Creative Awards competition entry fee (digital service, no shipping)" }] } : undefined;
      const at = now();
      const closesAt = new Date(order.paymentClosesAtExclusive);
      const expiresAt = new Date(Math.min(at.getTime() + TOSS_CHECKOUT_TTL_MS, closesAt.getTime()));
      if (expiresAt <= at) throw new EntryFault("DEADLINE_PASSED", 409);
      const base = new URL(siteOrigin).origin;
      return PaymentCheckoutSessionSchema.parse({
        orderId: order.id, provider: "tosspayments", mode: config.liveMode ? "live" : "test",
        expiresAt: expiresAt.toISOString(),
        launch: {
          kind: "tosspayments_sdk", clientKey,
          // Toss requires 2-50 characters including one of - _ = . @ and an unguessable value.
          customerKey: `gyca-${customerReference.slice(0, 40)}`,
          orderName: "GYCA Entry Fee", method: config.method,
          amount: { currency: config.currency, value },
          ...(foreignEasyPay === undefined ? {} : { foreignEasyPay }),
          successUrl: `${base}/mypage/entries/${encodeURIComponent(order.entryId)}/payment/success`,
          failUrl: `${base}/mypage/entries/${encodeURIComponent(order.entryId)}/payment/fail`,
        },
      });
    };
  return {
    id: "tosspayments", merchantAccount: config.merchantAccount, liveMode: config.liveMode,
    confirmationReplayWindowMs: 15 * 86400000,
    ...(beginCheckout === undefined ? {} : { beginCheckout }),
    confirm: async (order: PaymentOrder, paymentKey: string, key: string) => {
      requireCurrency(order);
      const amount = providerAmount(order.money.amountMinor, exponent);
      const payment = await call("/v1/payments/confirm", { paymentKey, orderId: order.id, amount }, key);
      if (payment.orderId !== order.id || payment.paymentKey !== paymentKey) throw new EntryFault("FORBIDDEN", 403);
      return normalize(payment);
    },
    refund: async (order: PaymentOrder, paymentKey: string, refundMinor: number, reason: string, key: string) => {
      requireCurrency(order);
      const cancelAmount = providerAmount(refundMinor, exponent);
      // Foreign easy pay cancellations must name the currency; PayPal may also settle a cancellation
      // later, so anything other than a completed cancel stays pending rather than being recorded.
      const body = config.method === "FOREIGN_EASY_PAY" ? { cancelReason: reason, cancelAmount, currency: config.currency }
        : { cancelReason: reason, cancelAmount };
      const payment = await call(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, body, key);
      if (payment.orderId !== order.id || payment.paymentKey !== paymentKey) throw new EntryFault("FORBIDDEN", 403);
      const cancellation = payment.cancels?.at(-1);
      if (cancellation === undefined || amountMinor(cancellation.cancelAmount, exponent) !== refundMinor
        || (cancellation.cancelStatus !== undefined && cancellation.cancelStatus !== "DONE"))
        throw new EntryFault("PAYMENT_UNAVAILABLE", 502);
      return RefundEvidenceSchema.parse({ refundId: cancellation.transactionKey, orderId: order.id, paymentId: paymentKey,
        amountMinor: refundMinor, currency: payment.currency, refundedAt: new Date(cancellation.canceledAt).toISOString() });
    },
    reconcile: async (order) => [await lookup(order.id)],
    // Toss payment webhooks carry no signature: the notification only names the order, and the
    // authenticated lookup is the evidence. Forged status or amount fields are therefore ignored.
    verifyWebhook: async (bytes) => {
      let value: unknown;
      try { value = JSON.parse(Buffer.from(bytes).toString("utf8")); }
      catch (error) { if (error instanceof SyntaxError) throw new EntryFault("VALIDATION_FAILED", 422); throw error; }
      const notification = z.object({ eventType: z.enum(["PAYMENT_STATUS_CHANGED", "CANCEL_STATUS_CHANGED"]),
        data: z.object({ orderId: z.uuid(), paymentKey: z.string().min(1).max(200), mId: z.string().optional() }) }).safeParse(value);
      if (!notification.success) throw new EntryFault("VALIDATION_FAILED", 422);
      // Another merchant account's notification is not ours to look up.
      if (notification.data.data.mId !== undefined && notification.data.data.mId !== config.merchantAccount) throw new EntryFault("FORBIDDEN", 403);
      const verified = await lookup(notification.data.data.orderId);
      if (verified.paymentId !== notification.data.data.paymentKey) throw new EntryFault("FORBIDDEN", 403);
      return verified;
    },
  };
}
