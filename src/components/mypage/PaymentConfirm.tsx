"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Message, StatusBadge, PaymentRouting } from "@/components/ds";
import {
  getEntryDetail, getEntryPaymentOptions, createEntryOrder, newIdempotencyKey, getOrder, beginCheckout, confirmOrder,
} from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { launchCheckout } from "@/lib/payments/launch";
import { money } from "@/lib/entry-view";
import type { EntryDetail } from "@/contracts";
import type { PaymentOptions } from "@/contracts/payment-options";
import type { PaymentOrder } from "@/contracts/payments";
import type { Locale } from "@/lib/i18n";

// Interactive payment confirmation for one entry. CLIENT component: it fetches
// the entry with the Better Auth session (a server component cannot forward the
// cookie), then drives everything off server facts:
//   - entry.allowedActions.start_payment → this page may offer payment. The real
//     buttons are gated again by the server-priced payment options (create_order)
//     and by the order's own allowedActions (start_payment only when a provider
//     can actually launch a window).
//   - Toss returns to /payment/success with paymentKey → POST /orders/{id}/confirm.
//     The server re-reads its order amount and verifies with the provider; this
//     page never treats the success URL itself as a completed payment.
//   - check_payment → re-fetch the entry/order (the server is the source of truth).

type Phase = "loading" | "notfound" | "error" | "ready";
export type ProviderReturn =
  | { kind: "success"; paymentKey: string | null; orderId: string | null; amount: string | null }
  | { kind: "fail"; code: string | null; message: string | null; orderId: string | null };
type ConfirmPhase = { kind: "idle" } | { kind: "confirming" } | { kind: "done" } | { kind: "error"; message: string };

const BLOCKING_MSG: Record<string, { en: string; ko: string }> = {
  PAYMENT_UNAVAILABLE: { en: "Payment is not available for this entry yet.", ko: "아직 이 접수에 대한 결제가 열리지 않았습니다." },
  DEADLINE_PASSED: { en: "The payment deadline has passed.", ko: "결제 마감이 지났습니다." },
  ENTRY_LOCKED: { en: "This entry cannot start a new payment.", ko: "이 접수는 새 결제를 시작할 수 없습니다." },
  POLICY_NOT_CONFIGURED: { en: "Payment policy is not configured yet.", ko: "결제 정책이 아직 설정되지 않았습니다." },
};

export default function PaymentConfirm({ id, locale, providerReturn = null }: {
  id: string; locale: Locale; providerReturn?: ProviderReturn | null;
}) {
  const ko = locale === "ko";
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmPhase, setConfirmPhase] = useState<ConfirmPhase>(() => (isLive && providerReturn?.kind === "success" ? { kind: "confirming" } : { kind: "idle" }));
  const confirmedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getEntryDetail(id);
      if (!alive) return;
      if (res.kind !== "success") {
        setPhase(res.kind === "error" && res.code !== "NOT_FOUND" && res.code !== "UNAUTHENTICATED" ? "error" : "notfound");
        return;
      }
      setEntry(res.data);
      setPhase("ready");
    })();
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  // Provider return: whether the success-URL parameters name this entry's own order. Derived
  // from server facts at render time; a mismatch is never sent to the server.
  const returnedOrder = providerReturn?.kind === "success" ? providerReturn : null;
  const ownOrderId = entry?.payment?.orderId ?? null;
  const returnMatches = returnedOrder !== null && entry !== null && ownOrderId !== null
    && returnedOrder.paymentKey !== null && returnedOrder.orderId === ownOrderId;
  const returnMismatch = returnedOrder !== null && entry !== null && !returnMatches;

  // Confirm exactly once per page load. The server re-reads its own order amount and verifies the
  // approval with the provider; the result is then re-read from the entry.
  useEffect(() => {
    if (!isLive || !returnMatches || confirmedRef.current || ownOrderId === null || returnedOrder === null) return;
    confirmedRef.current = true;
    if (entry?.payment?.state === "succeeded") { setTimeout(() => setConfirmPhase({ kind: "done" }), 0); return; }
    confirmOrder(ownOrderId, returnedOrder.paymentKey as string).then((res) => {
      if (res.kind === "success") setConfirmPhase({ kind: "done" });
      else setConfirmPhase({ kind: "error", message: res.kind === "error" ? res.message
        : ko ? "결제 확인에 실패했습니다." : "Payment confirmation failed." });
      setReloadKey((k) => k + 1);
    });
  }, [returnMatches, ownOrderId, returnedOrder, entry, ko]);

  // Loading is re-armed only in a handler (never synchronously in the effect).
  const retry = () => {
    setEntry(null);
    setPhase("loading");
    setReloadKey((k) => k + 1);
  };
  // Re-check re-reads the server state in place (keeps the current view) and
  // stamps the time for visible feedback.
  const recheck = () => {
    setLastChecked(new Date().toLocaleTimeString(ko ? "ko-KR" : "en-GB"));
    setReloadKey((k) => k + 1);
  };

  if (phase === "loading") {
    return (
      <div className="max-w-[46rem]" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface" />
        <span className="sr-only" role="status">
          {ko ? "불러오는 중" : "Loading"}
        </span>
      </div>
    );
  }

  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <div className="max-w-[46rem]">
        <Message
          tone={isError ? "danger" : "info"}
          title={
            isError
              ? ko ? "불러오지 못했습니다" : "Could not load"
              : ko ? "접수를 찾을 수 없습니다" : "Entry not found"
          }
        >
          {isError
            ? ko ? "문제가 발생했습니다. 다시 시도해 주세요." : "Something went wrong. Please try again."
            : ko ? "해당 접수가 없거나 접근 권한이 없습니다." : "This entry does not exist or you don't have access."}
        </Message>
        <div className="mt-6 flex flex-wrap gap-3">
          {isError && <Button onClick={retry}>{ko ? "다시 시도" : "Retry"}</Button>}
          <Button href={`/mypage/entries/${id}`} variant={isError ? "outline" : "primary"}>
            {ko ? "접수 상세로" : "Back to entry"}
          </Button>
        </div>
      </div>
    );
  }

  const e = entry as EntryDetail;
  const p = e.payment;
  const paid = p?.state === "succeeded";
  const pending = p?.state === "pending";
  const canRecheck = e.allowedActions.includes("check_payment");
  const canStart = e.allowedActions.includes("start_payment");
  const amount = p ? money(p, ko) : null;

  return (
    <div className="max-w-[46rem]">
      {/* Fee + current state */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[16px] text-ink-strong">{ko ? "출품비" : "Entry fee"}</p>
            <p className="mt-1 text-[24px] font-extrabold text-ink-strong">{amount ?? "—"}</p>
          </div>
          <StatusBadge tone={paid ? "success" : pending ? "warning" : "neutral"}>
            {paid
              ? ko
                ? "결제완료"
                : "Paid"
              : pending
                ? ko
                  ? "결제 대기"
                  : "Pending"
                : ko
                  ? "미결제"
                  : "Not paid"}
          </StatusBadge>
        </div>
      </div>

      {/* Provider return: confirming with the server */}
      {returnMismatch && (
        <Message tone="warning" className="mt-6" title={ko ? "결제 확인 보류" : "Payment verification pending"}>
          {ko
            ? "결제창에서 돌아온 정보가 이 접수의 주문과 일치하지 않아 확인을 보내지 않았습니다. 아래 상태 재확인으로 서버 상태를 확인해 주세요."
            : "The payment return does not name this entry's order, so no confirmation was sent. Use re-check below to read the server state."}
        </Message>
      )}
      {returnMatches && confirmPhase.kind === "confirming" && (
        <Message tone="info" className="mt-6" title={ko ? "결제 승인 확인 중" : "Verifying payment"}>
          {ko
            ? "결제창에서 돌아왔습니다. 서버가 결제사에 승인 내역을 확인하는 중입니다. 이 화면을 닫지 마세요."
            : "You've returned from the payment window. The server is verifying the approval with the provider. Please keep this page open."}
        </Message>
      )}
      {returnMatches && confirmPhase.kind === "error" && (
        <Message tone="warning" className="mt-6" title={ko ? "결제 확인 보류" : "Payment verification pending"}>
          {confirmPhase.message}{" "}
          {ko
            ? "카드가 결제됐다면 아래 상태 재확인으로 반영됩니다. 중복 결제는 일어나지 않습니다."
            : "If your card was charged, re-checking the status below will reflect it. No duplicate charge is made."}
        </Message>
      )}
      {providerReturn?.kind === "fail" && !paid && (
        <Message tone="danger" className="mt-6" title={ko ? "결제가 완료되지 않았습니다" : "Payment was not completed"}>
          {providerReturn.message
            ? `${providerReturn.message}${providerReturn.code ? ` (${providerReturn.code})` : ""}`
            : ko ? "결제창에서 결제가 취소되었거나 실패했습니다." : "The payment was cancelled or failed in the payment window."}{" "}
          {ko ? "청구된 금액은 없으며 다시 시도할 수 있습니다." : "Nothing was charged. You can try again."}
        </Message>
      )}

      {/* Confirmed + received */}
      {paid && e.entryStatus === "received" && (
        <Message tone="success" className="mt-6" title={ko ? "결제 완료 · 접수 완료" : "Paid · entry received"}>
          <span className="block">
            {ko ? "접수번호" : "Receipt no."}: {e.receiptNumber}
          </span>
        </Message>
      )}

      {/* Paid but the server is still confirming the entry */}
      {paid && e.entryStatus !== "received" && (
        <Message
          tone="info"
          className="mt-6"
          title={ko ? "결제 완료 · 접수 확정 확인 중" : "Paid · confirming entry"}
        >
          {ko
            ? "결제는 확인됐지만 서버에서 접수 확정을 확인하는 중입니다. 확정되면 접수번호가 발급됩니다."
            : "Payment is confirmed, but the server is still confirming the entry. A receipt number is issued once confirmed."}
        </Message>
      )}

      {/* Pending approval */}
      {pending && !(returnMatches && confirmPhase.kind === "confirming") && (
        <Message
          tone="warning"
          className="mt-6"
          title={ko ? "결제 확인 중" : "Payment pending"}
        >
          {ko
            ? "아직 승인이 확인되지 않았습니다. 성공 URL 도착만으로 완료 처리하지 않으며, 서버 상태를 재확인합니다."
            : "Approval has not been verified yet. Arriving at a success URL is not treated as complete; we re-check the server."}
        </Message>
      )}

      {/* Re-check (check_payment) */}
      {canRecheck && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={recheck}>
            {ko ? "상태 재확인" : "Re-check status"}
          </Button>
          {lastChecked && (
            <span className="text-[16px] text-ink-strong">
              {ko ? "마지막 확인" : "Last checked"}: {lastChecked}
            </span>
          )}
        </div>
      )}

      {/* Start / retry payment */}
      {canStart && !paid && !(returnMatches && confirmPhase.kind === "confirming") &&
        (isLive ? (
          <LivePayment entryId={id} orderId={p?.orderId ?? null} locale={locale} onOrderCreated={recheck} />
        ) : (
          <div className="mt-8 rounded-2xl border border-line bg-white p-6">
            <PaymentRouting locale={locale} scenario="createReady" />
          </div>
        ))}

      <div className="mt-8">
        <Button href={`/mypage/entries/${id}`} variant="ghost">
          {ko ? "접수 상세로" : "Back to entry"}
        </Button>
      </div>
    </div>
  );
}

// LIVE payment start. Without an order: server-priced routes → refund-notice consent → create order
// (idempotent) → open the provider window. With a pending order: open the window again. Every
// button is gated by server allowedActions; the amount and currency are never sent by the browser.
function LivePayment({ entryId, orderId, locale, onOrderCreated }: {
  entryId: string; orderId: string | null; locale: Locale; onOrderCreated: () => void;
}) {
  const ko = locale === "ko";
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orderKey = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (orderId === null) {
        const res = await getEntryPaymentOptions(entryId);
        if (!alive) return;
        if (res.kind === "success") {
          setOptions(res.data);
          if (res.data.routes.length === 1) setRouteId(res.data.routes[0].id);
        } else setLoadError(res.kind === "error" ? res.message : ko ? "결제 옵션을 불러오지 못했습니다." : "Could not load payment options.");
      } else {
        const res = await getOrder(orderId);
        if (!alive) return;
        if (res.kind === "success") setOrder(res.data);
        else setLoadError(res.kind === "error" ? res.message : ko ? "주문을 불러오지 못했습니다." : "Could not load the order.");
      }
    })();
    return () => { alive = false; };
  }, [entryId, orderId, ko]);

  const open = async (target: PaymentOrder) => {
    const checkout = await beginCheckout(target.id);
    if (checkout.kind !== "success") {
      setError(checkout.kind === "error" && checkout.code === "PAYMENT_UNAVAILABLE"
        ? ko ? "결제창을 열 수 없습니다. 결제 공급자가 아직 준비되지 않았습니다." : "The payment window cannot be opened yet: the payment provider is not ready."
        : checkout.kind === "error" ? checkout.message : ko ? "결제창을 열지 못했습니다." : "Could not open the payment window.");
      return;
    }
    const outcome = await launchCheckout(checkout.data);
    if (outcome.kind === "navigating") return;
    setError(outcome.kind === "cancelled"
      ? ko ? "결제창을 닫았습니다. 청구된 금액은 없으며 다시 시도할 수 있습니다." : "You closed the payment window. Nothing was charged; you can try again."
      : outcome.message);
  };

  const createAndOpen = async () => {
    if (!options) return;
    const route = options.routes.find((r) => r.id === routeId);
    if (!route || !accepted) return;
    setBusy(true);
    setError(null);
    if (orderKey.current === null) orderKey.current = newIdempotencyKey();
    const res = await createEntryOrder(entryId, { routeId: route.id, policyToken: route.policyToken, acceptedRefundNotice: true },
      { idempotencyKey: orderKey.current });
    if (res.kind !== "success") {
      setBusy(false);
      setError(res.kind === "error" ? res.message : ko ? "주문 생성에 실패했습니다." : "Could not create the order.");
      if (res.kind === "error" && res.code === "CONSENT_REQUIRED") setAccepted(false);
      return;
    }
    setOrder(res.data);
    onOrderCreated();
    if (res.data.state === "pending" && res.data.allowedActions.includes("start_payment")) await open(res.data);
    else if (res.data.state === "pending") setError(ko ? "주문은 생성됐지만 결제창을 열 수 없습니다. 결제 공급자가 준비되면 이 화면에서 진행할 수 있습니다."
      : "The order was created, but the payment window is not available yet. You can continue here once the provider is ready.");
    setBusy(false);
  };

  const reopen = async () => {
    if (!order) return;
    setBusy(true);
    setError(null);
    await open(order);
    setBusy(false);
  };

  if (loadError) {
    return <Message tone="danger" className="mt-8" title={ko ? "오류" : "Error"}>{loadError}</Message>;
  }

  // Existing order: only the server's own allowedActions decide whether a window can be opened.
  if (orderId !== null) {
    if (!order) return <div className="mt-8 h-20 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" />;
    const launchable = order.allowedActions.includes("start_payment");
    return (
      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h3 className="font-title text-[20px] font-bold text-ink-strong">{ko ? "결제 진행" : "Pay now"}</h3>
        {launchable ? (
          <>
            <p className="mt-2 text-[16px] text-ink-strong">
              {ko ? "토스페이먼츠 결제창에서 카드로 결제합니다. 결제 후 이 페이지로 돌아와 서버가 승인 내역을 확인합니다."
                : "You'll pay by card in the Toss Payments window and return here for the server to verify the approval."}
            </p>
            <Button className="mt-4" onClick={reopen} disabled={busy}>{busy ? (ko ? "여는 중…" : "Opening…") : ko ? "결제창 열기" : "Open payment window"}</Button>
          </>
        ) : (
          <Message tone="warning" className="mt-4">
            {order.blockingReasons.map((r) => BLOCKING_MSG[r]?.[locale] ?? r).join(" ") || (ko ? "지금은 결제를 시작할 수 없습니다." : "Payment cannot be started right now.")}
          </Message>
        )}
        {error && <Message tone="danger" className="mt-4">{error}</Message>}
      </div>
    );
  }

  if (!options) return <div className="mt-8 h-20 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" />;
  const canCreate = options.allowedActions.includes("create_order") && options.routes.length > 0;
  const selected = options.routes.find((r) => r.id === routeId);

  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-6">
      <h3 className="font-title text-[20px] font-bold text-ink-strong">{ko ? "결제 방법" : "Payment"}</h3>
      {(selected?.money ?? options.money) && (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-[16px] text-ink-strong">{ko ? "참가비" : "Entry fee"}</span>
          <span className="text-[22px] font-extrabold text-ink-strong">{money((selected?.money ?? options.money) as NonNullable<typeof options.money>, ko)}</span>
        </p>
      )}
      {!canCreate ? (
        <Message tone="warning" className="mt-5">
          {options.blockingReasons.map((r) => BLOCKING_MSG[r]?.[locale] ?? r).join(" ") || (ko ? "결제 준비 중입니다." : "Payment is being prepared.")}
        </Message>
      ) : (
        <>
          <fieldset className="mt-5">
            <legend className="text-[16px] font-semibold text-ink-strong">{ko ? "결제 경로" : "Payment route"}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {options.routes.map((r) => (
                <label key={r.id} className="flex items-start gap-3 rounded-lg border border-line p-4">
                  <input type="radio" name="route" className="mt-1" checked={routeId === r.id}
                    onChange={() => { setRouteId(r.id); setAccepted(false); }} />
                  <span>
                    <span className="block font-semibold text-ink-strong">{r.label[locale]}</span>
                    <span className="block text-[15px] text-ink-strong">{money(r.money, ko)}</span>
                    {r.mode === "test" && <StatusBadge tone="warning">{ko ? "테스트 결제" : "Test mode"}</StatusBadge>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {selected && (
            <div className="mt-4 rounded-lg border border-line bg-surface p-4">
              <p className="text-[15px] font-semibold text-ink-strong">{ko ? "환불 규정" : "Refund policy"}</p>
              <p className="mt-1 whitespace-pre-line text-[15px] text-ink-strong">{selected.refundNotice[locale]}</p>
              <label className="mt-3 flex items-center gap-2 text-[15px] text-ink-strong">
                <input type="checkbox" checked={accepted} onChange={(ev) => setAccepted(ev.target.checked)} />
                {ko ? "환불 규정을 확인했습니다." : "I have read the refund policy."}
              </label>
            </div>
          )}
          <Button className="mt-5" onClick={createAndOpen} disabled={busy || !selected || !accepted}>
            {busy ? (ko ? "결제창 여는 중…" : "Opening…") : ko ? "결제하기" : "Pay entry fee"}
          </Button>
          <p className="mt-2 text-[14px] text-ink">
            {ko ? "결제 완료 후 서버가 승인 내역을 확인한 뒤 접수번호가 발급됩니다."
              : "After payment the server verifies the approval before issuing a receipt number."}
          </p>
        </>
      )}
      {error && <Message tone="danger" className="mt-4">{error}</Message>}
    </div>
  );
}
