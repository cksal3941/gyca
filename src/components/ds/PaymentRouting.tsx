"use client";

import { useState } from "react";
import { Button, Message, StatusBadge } from "@/components/ds";
import {
  getPaymentOptionsSync,
  canCreateOrder,
  createOrder,
  newIdempotencyKey,
  type PaymentOptionsScenario,
} from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import type { PaymentOrder } from "@/contracts/payments";

// MOCK payment routing (candidate guidance → order creation). This is NOT a real
// payment window: even when a candidate exists, `create_order` only records the
// selected route/policy. Keep behind mock/dev until the PG checkout is wired.

const BLOCKING_MSG: Record<string, { en: string; ko: string }> = {
  PAYMENT_UNAVAILABLE: { en: "Payment is being prepared.", ko: "결제 준비 중입니다." },
  DEADLINE_PASSED: { en: "The payment deadline has passed.", ko: "결제 마감이 지났습니다." },
  ENTRY_LOCKED: { en: "An order is already in progress for this entry.", ko: "진행 중인 주문이 있어 새 결제 경로를 만들 수 없습니다." },
  POLICY_NOT_CONFIGURED: { en: "Payment policy is not configured yet.", ko: "결제 정책이 아직 설정되지 않았습니다." },
};

function formatMoney(amountMinor: number): string {
  return `€${(amountMinor / 100).toFixed(amountMinor % 100 === 0 ? 0 : 2)}`;
}

export default function PaymentRouting({
  locale = "en",
  scenario = "createReady",
  onOrderCreated,
  className,
}: {
  locale?: Locale;
  scenario?: PaymentOptionsScenario;
  onOrderCreated?: () => void;
  className?: string;
}) {
  const ko = locale === "ko";
  const state = getPaymentOptionsSync(scenario);

  const [routeId, setRouteId] = useState<string>("");
  const [accepted, setAccepted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (state.kind === "error") {
    return (
      <div className={className}>
        <Message tone="danger" title={ko ? "오류" : "Error"}>
          {state.message}
        </Message>
      </div>
    );
  }
  if (state.kind !== "success") {
    return (
      <div className={className}>
        <Message tone="info">
          {ko ? "결제 경로를 불러오는 중입니다." : "Loading payment options…"}
        </Message>
      </div>
    );
  }
  const options = state.data;

  async function submit() {
    const route = options.routes.find((r) => r.id === routeId);
    if (!route || !accepted) return;
    setCreating(true);
    setError(null);
    const res = await createOrder(
      { routeId: route.id, policyToken: route.policyToken, acceptedRefundNotice: true },
      { idempotencyKey: newIdempotencyKey() },
    );
    setCreating(false);
    if (res.kind === "success") {
      setOrder(res.data);
      onOrderCreated?.();
    } else if (res.kind === "error") {
      setError(res.message);
      // On CONSENT_REQUIRED the refund notice changed → require re-acceptance.
      if (res.code === "CONSENT_REQUIRED") setAccepted(false);
    }
  }

  const selectedRoute = options.routes.find((r) => r.id === routeId);

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h3 className="font-title text-[20px] font-bold text-ink-strong">
          {ko ? "결제 경로 안내" : "Payment options"}
        </h3>
        <StatusBadge tone="neutral">{ko ? "미리보기 · Mock" : "Preview · Mock"}</StatusBadge>
      </div>

      {options.money && (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[16px] text-ink-strong">{ko ? "참가비" : "Entry fee"}</span>
          <span className="text-[22px] font-extrabold text-ink-strong">
            {formatMoney(options.money.amountMinor)}
          </span>
        </p>
      )}
      {options.country && (
        <p className="mt-1 text-[16px] text-ink-strong">
          {ko ? "거주국 기준 안내" : "Guidance by residence"}: {options.country}
          <span className="ml-1 text-ink">
            {ko ? " (카드 발급국·승인 보장 아님)" : " (not a card-issuer / approval guarantee)"}
          </span>
        </p>
      )}

      {/* Order created (mock pending) */}
      {order ? (
        <div className="mt-5">
          <div className="mb-3">
            <StatusBadge tone="warning">
              {ko ? "결제 대기 · Pending" : "Pending"}
            </StatusBadge>
          </div>
          <Message tone="info" title={ko ? "주문이 생성되었습니다 (mock)" : "Order created (mock)"}>
            {ko
              ? "선택한 경로로 주문이 고정됐습니다. 실제 결제창은 준비 중이라 결제는 아직 진행되지 않습니다. 상태는 이후 확인(check_payment)으로 갱신됩니다."
              : "The order is pinned to the selected route. The real payment window isn't wired yet, so no payment is taken. Status updates later via check_payment."}
          </Message>
        </div>
      ) : !canCreateOrder(options) ? (
        // Blocked — explain why (never a payment button)
        <Message tone="warning" className="mt-5">
          {options.blockingReasons
            .map((r) => BLOCKING_MSG[r]?.[locale] ?? r)
            .join(" ") || (ko ? "결제 준비 중입니다." : "Payment is being prepared.")}
        </Message>
      ) : (
        <>
          {/* Route selection */}
          <fieldset className="mt-5">
            <legend className="mb-2 text-[16px] font-semibold text-ink-strong">
              {ko ? "결제 경로 선택" : "Select a payment route"}
            </legend>
            <div className="flex flex-col gap-2">
              {options.routes.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-field p-3 hover:border-brand-blue"
                >
                  <input
                    type="radio"
                    name="payment-route"
                    value={r.id}
                    checked={routeId === r.id}
                    onChange={() => setRouteId(r.id)}
                    className="mt-1 h-4 w-4 accent-brand-blue"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[16px] font-semibold text-ink-strong">
                        {r.label[locale]}
                      </span>
                      <StatusBadge tone={r.mode === "live" ? "success" : "warning"}>
                        {r.mode.toUpperCase()}
                      </StatusBadge>
                    </span>
                    <span className="mt-1 block text-[16px] text-ink-strong">
                      {r.refundNotice[locale]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Refund-notice acceptance (required before create) */}
          <label className="mt-4 flex items-start gap-3 rounded-lg border border-field bg-canvas p-4">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-blue"
            />
            <span className="text-[16px] leading-[1.6] text-ink-strong">
              {selectedRoute
                ? selectedRoute.refundNotice[locale]
                : ko
                  ? "환불 안내를 확인하고 동의합니다."
                  : "I have read and accept the refund notice."}
              <span className="text-danger" aria-hidden>{" *"}</span>
            </span>
          </label>

          {error && (
            <Message tone="danger" className="mt-4">
              {error}
            </Message>
          )}

          <div className="mt-5">
            <Button
              onClick={submit}
              disabled={!routeId || !accepted || creating}
            >
              {creating
                ? ko ? "생성 중…" : "Creating…"
                : ko ? "주문 생성" : "Create order"}
            </Button>
            <p className="mt-2 text-[16px] text-ink-strong">
              {ko
                ? "주문 생성은 경로·정책을 고정할 뿐이며 실제 결제(결제창)는 아직 없습니다."
                : "Creating an order only pins the route/policy — there is no real payment window yet."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
