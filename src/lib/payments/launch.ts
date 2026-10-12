"use client";

import type { PaymentCheckoutSession } from "@/contracts/payments";

// Opens the payment window the server described. Only the server-fixed launch values are used:
// the browser never chooses the amount, currency, order or return URLs. Navigating away (or Toss
// redirecting to successUrl) is NOT payment completion — the success page confirms with the server.

const TOSS_SDK_URL = "https://js.tosspayments.com/v2/standard";

type TossPaymentWindow = {
  requestPayment(request: Record<string, unknown>): Promise<unknown>;
};
type TossPayments = (clientKey: string) => { payment(options: { customerKey: string }): TossPaymentWindow };
declare global {
  interface Window { TossPayments?: TossPayments }
}

let sdkLoading: Promise<TossPayments> | null = null;

function loadTossSdk(): Promise<TossPayments> {
  if (typeof window === "undefined") return Promise.reject(new Error("Toss SDK requires a browser"));
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise<TossPayments>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TOSS_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.TossPayments) resolve(window.TossPayments);
      else reject(new Error("Toss SDK did not initialise"));
    };
    script.onerror = () => {
      sdkLoading = null;
      script.remove();
      reject(new Error("Toss SDK failed to load"));
    };
    document.head.appendChild(script);
  });
  return sdkLoading;
}

export type LaunchOutcome =
  | { kind: "navigating" }
  | { kind: "cancelled" }
  | { kind: "error"; code: string; message: string };

const tossError = (error: unknown): LaunchOutcome => {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "LAUNCH_FAILED";
  const message = typeof e?.message === "string" ? e.message : "결제창을 여는 중 문제가 발생했습니다.";
  // The buyer closed the window or abandoned the request: nothing was charged.
  if (code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED" || code === "PAYMENT_REQUEST_ABORTED") return { kind: "cancelled" };
  return { kind: "error", code, message };
};

/** Launch the checkout described by a PaymentCheckoutSession. Resolves when the browser is
 *  navigating to the provider (redirect) or when the provider window closed without payment. */
export async function launchCheckout(session: PaymentCheckoutSession): Promise<LaunchOutcome> {
  const launch = session.launch;
  if (launch.kind === "redirect") {
    window.location.assign(launch.url);
    return { kind: "navigating" };
  }
  let sdk: TossPayments;
  try { sdk = await loadTossSdk(); }
  catch (error) { return { kind: "error", code: "SDK_UNAVAILABLE", message: error instanceof Error ? error.message : String(error) }; }
  try {
    const window_ = sdk(launch.clientKey).payment({ customerKey: launch.customerKey });
    // windowTarget "self" keeps one flow on every device: Toss navigates this tab to its window
    // and returns to successUrl/failUrl, where the server verifies the approval.
    await window_.requestPayment({
      method: launch.method,
      amount: { currency: launch.amount.currency, value: launch.amount.value },
      orderId: session.orderId,
      orderName: launch.orderName,
      successUrl: launch.successUrl,
      failUrl: launch.failUrl,
      windowTarget: "self",
      ...(launch.foreignEasyPay === undefined ? {} : { foreignEasyPay: launch.foreignEasyPay }),
    });
    return { kind: "navigating" };
  } catch (error) {
    return tossError(error);
  }
}
