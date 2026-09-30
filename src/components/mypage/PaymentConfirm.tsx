"use client";

import { useEffect, useState } from "react";
import { Button, Message, StatusBadge, PaymentRouting } from "@/components/ds";
import { getEntryDetail } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { money } from "@/lib/entry-view";
import type { EntryDetail } from "@/contracts";
import type { Locale } from "@/lib/i18n";

// Interactive payment confirmation for one entry. CLIENT component: it fetches
// the entry with the Better Auth session (a server component cannot forward the
// cookie), then drives everything off the entry's server-provided payment state
// and allowedActions:
//   - start_payment  → route select + order creation. The real PG window is NOT
//                      wired, so live shows an honest "not connected" notice; the
//                      mock preview keeps the PaymentRouting demo.
//   - check_payment  → re-fetch the entry (the server is the source of truth;
//                      arriving at a success URL is never treated as "done").
//   - succeeded/received → paid / receipt confirmation

type Phase = "loading" | "notfound" | "error" | "ready";

export default function PaymentConfirm({ id, locale }: { id: string; locale: Locale }) {
  const ko = locale === "ko";
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  const amount = p ? money(p.amountMinor) : null;

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
      {pending && (
        <Message
          tone="warning"
          className="mt-6"
          title={ko ? "결제 확인 중" : "Payment pending"}
        >
          {ko
            ? "승인 확인이 진행 중입니다. 성공 URL 도착만으로 완료 처리하지 않으며, 서버 상태를 재확인합니다."
            : "Approval is being verified. Arriving at a success URL is not treated as complete; we re-check the server."}
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
      {canStart &&
        (isLive ? (
          <Message
            tone="info"
            className="mt-8"
            title={ko ? "결제 준비 중" : "Payment not connected yet"}
          >
            {ko
              ? "주문은 서버에 생성되지만 실제 결제창(PG)은 아직 연결되지 않았습니다. 결제 수단이 연결되면 이 화면에서 진행할 수 있습니다."
              : "An order can be created on the server, but the real payment window (PG) is not connected yet. You'll be able to pay here once it's wired."}
          </Message>
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
