"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Button, Message, StatusBadge, Select, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  getAdminDashboard, getPaymentHealth, listPaymentReviews, listAdminCompetitions,
  requeueRecovery, acceptLatePayment, getRefundOverview, requestRefund,
  type AdminDashboard, type PaymentHealth, type PaymentReview, type AdminCompetitionRef, type RefundOverview,
} from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";

// Payment operations (LIVE, organizer). Dashboard + per-competition health,
// orders needing review, and operator mutations driven by server allowedActions:
// requeue stalled recovery, accept an after-deadline payment, and request refunds.
// Approved amounts are gross (pre-refund) — not settlement revenue. A button click
// is never treated as final success: the ledger is re-fetched after each action.

const money = (m: number) => `€${(m / 100).toFixed(0)}`;
const PAY_TONE: Record<string, Tone> = { pending: "warning", succeeded: "success", failed: "danger", cancelled: "danger", expired: "neutral" };

// One review row with its operator actions (requeue / accept-late). Actions are
// shown only when the server lists them; each needs a reason + the expected
// timestamp the list returned (optimistic concurrency).
function ReviewRow({ competitionId, r, onDone }: { competitionId: string; r: PaymentReview; onDone: () => void }) {
  const [open, setOpen] = useState<"requeue" | "accept" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  const run = async (kind: "requeue" | "accept") => {
    if (reason.trim() === "") { setMsg({ tone: "danger", text: "사유를 입력하세요." }); return; }
    const expectedUpdatedAt = r.recovery?.updatedAt;
    const expectedReviewedAt = r.reviewedAt;
    if (kind === "requeue" && !expectedUpdatedAt) { setMsg({ tone: "danger", text: "복구 상태가 없어 재큐할 수 없습니다." }); return; }
    if (kind === "accept" && !expectedReviewedAt) { setMsg({ tone: "danger", text: "검토 시각이 없어 확정할 수 없습니다." }); return; }
    setBusy(true); setMsg(null);
    const res = kind === "requeue"
      ? await requeueRecovery(competitionId, r.orderId, { actionId: crypto.randomUUID(), reason: reason.trim(), expectedUpdatedAt: expectedUpdatedAt! })
      : await acceptLatePayment(competitionId, r.orderId, { actionId: crypto.randomUUID(), reason: reason.trim(), expectedReviewedAt: expectedReviewedAt! });
    setBusy(false);
    if (res.kind === "success") {
      setMsg({ tone: "success", text: kind === "requeue" ? "복구를 재큐했습니다." : `접수 확정됨 (접수번호 ${(res.data as { receiptNumber?: string }).receiptNumber ?? "발급"}).` });
      setReason(""); setOpen(null); onDone();
    } else setMsg({ tone: "danger", text: res.kind === "error" ? res.message : "처리 실패" });
  };

  return (
    <li className="border-b border-line pb-3 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge tone={PAY_TONE[r.state] ?? "neutral"}>{r.state}</StatusBadge>
        <span className="text-[16px] font-semibold text-ink-strong">{money(r.money.amountMinor)}</span>
        <span className="text-[15px] text-ink-strong/70">{r.reviewReasons.join(", ")}</span>
        <span className="ml-auto flex gap-2">
          {r.allowedActions.includes("requeue_recovery") && <Button size="sm" variant="outline" onClick={() => { setOpen(open === "requeue" ? null : "requeue"); setMsg(null); }} disabled={busy}>복구 재큐</Button>}
          {r.allowedActions.includes("accept_late_payment") && <Button size="sm" onClick={() => { setOpen(open === "accept" ? null : "accept"); setMsg(null); }} disabled={busy}>지연 승인</Button>}
          {r.allowedActions.length === 0 && <span className="text-[15px] text-ink-strong/70">조치 없음</span>}
        </span>
      </div>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-surface p-3">
          <p className="text-[15px] font-semibold text-ink-strong">{open === "requeue" ? "복구 재큐 사유" : "지연 승인 사유"}</p>
          {open === "accept" && <p className="mt-1 text-[14px] text-ink-strong/70">마감 후 승인 결제를 접수로 확정합니다. 접수번호가 발급됩니다.</p>}
          <input className="mt-2 w-full rounded-lg border border-field bg-white px-3 py-2 text-[15px] text-ink-strong outline-none focus:border-brand-blue" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="내부 사유 (카드·연락처 등 개인정보 금지)" />
          <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => run(open)} disabled={busy}>{busy ? "처리 중…" : "확정"}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(null)} disabled={busy}>취소</Button></div>
        </div>
      )}
      {msg && <p className={`mt-2 text-[15px] ${msg.tone === "danger" ? "text-danger" : "text-ink-strong"}`}>{msg.text}</p>}
    </li>
  );
}

// Refund lookup + request for one order (refunds apply to succeeded orders, which
// may not be in the review list). Request is shown only when the server allows it.
function RefundPanel({ competitionId }: { competitionId: string }) {
  const [orderId, setOrderId] = useState("");
  const [ov, setOv] = useState<RefundOverview | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  const look = async () => {
    if (orderId.trim() === "") return;
    setBusy(true); setMsg(null); setOv(null);
    const r = await getRefundOverview(competitionId, orderId.trim());
    setBusy(false);
    if (r.kind === "success") setOv(r.data);
    else setMsg({ tone: "danger", text: r.kind === "error" ? r.message : "조회 실패" });
  };
  const refund = async () => {
    if (!ov) return;
    const minor = Math.round(Number(amount) * 100);
    if (!Number.isInteger(minor) || minor <= 0) { setMsg({ tone: "danger", text: "환불 금액을 확인하세요." }); return; }
    if (reason.trim() === "") { setMsg({ tone: "danger", text: "사유를 입력하세요." }); return; }
    setBusy(true); setMsg(null);
    const r = await requestRefund(competitionId, ov.orderId, { actionId: crypto.randomUUID(), amountMinor: minor, reason: reason.trim() });
    setBusy(false);
    if (r.kind === "success") { setOv(r.data); setAmount(""); setReason(""); setMsg({ tone: "success", text: "환불을 요청했습니다(응답 유실 시 pending). 원장을 확인하세요." }); }
    else setMsg({ tone: "danger", text: r.kind === "error" ? r.message : "환불 실패" });
  };

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-6">
      <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">환불 (주문별)</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className="min-w-[22rem] flex-1 rounded-lg border border-field bg-white px-3 py-2 text-[15px] text-ink-strong outline-none focus:border-brand-blue" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="주문 ID (UUID)" />
        <Button size="sm" variant="outline" onClick={look} disabled={busy}>조회</Button>
      </div>
      {msg && <p className={`mt-2 text-[15px] ${msg.tone === "danger" ? "text-danger" : "text-ink-strong"}`}>{msg.text}</p>}
      {ov && (
        <div className="mt-3 rounded-lg border border-line bg-surface p-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="neutral">원결제 {money(ov.money.amountMinor)}</StatusBadge>
            <StatusBadge tone="success">환불완료 {money(ov.refundedAmountMinor)}</StatusBadge>
            <StatusBadge tone="warning">대기 {money(ov.pendingAmountMinor)}</StatusBadge>
            <StatusBadge tone="neutral">잔여 {money(ov.remainingAmountMinor)}</StatusBadge>
          </div>
          {ov.refunds.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-[15px] text-ink-strong">
              {ov.refunds.map((f) => <li key={f.id}>{money(f.money.amountMinor)} · {f.state} · {f.reason}</li>)}
            </ul>
          )}
          {ov.allowedActions.includes("request_refund") ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_auto]">
              <input className="rounded-lg border border-field bg-white px-3 py-2 text-[15px] outline-none focus:border-brand-blue" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="금액 (EUR)" inputMode="decimal" />
              <input className="rounded-lg border border-field bg-white px-3 py-2 text-[15px] outline-none focus:border-brand-blue" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유" />
              <Button size="sm" onClick={refund} disabled={busy}>{busy ? "처리 중…" : "환불 요청"}</Button>
            </div>
          ) : (
            <p className="mt-2 text-[15px] text-ink-strong/70">환불 가능한 상태가 아닙니다.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [dash, setDash] = useState<RequestState<AdminDashboard>>({ kind: "loading" });
  const [comps, setComps] = useState<AdminCompetitionRef[]>([]);
  const [compId, setCompId] = useState<string>("");
  const [health, setHealth] = useState<PaymentHealth | null>(null);
  const [reviews, setReviews] = useState<PaymentReview[] | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAdminDashboard().then((r) => { if (alive) setDash(r); });
    listAdminCompetitions().then((r) => { if (alive && r.kind === "success") setComps(r.data); });
    return () => { alive = false; };
  }, []);

  const loadDetail = async (id: string) => {
    const [h, rv] = await Promise.all([getPaymentHealth(id), listPaymentReviews(id)]);
    if (h.kind === "success") setHealth(h.data); else if (h.kind === "error") setDetailErr(h.message);
    if (rv.kind === "success") setReviews([...rv.data.items]); else if (rv.kind === "empty") setReviews([]);
  };
  const pick = async (id: string) => {
    setCompId(id); setHealth(null); setReviews(null); setDetailErr(null);
    if (!id) return;
    await loadDetail(id);
  };

  return (
    <AdminShell eyebrow="Admin" title="결제 운영" crumbs={[{ label: "관리자", href: "/admin" }, { label: "결제 운영" }]}>
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">결제 운영 조회는 라이브(운영자)에서 동작합니다.</Message>}

        {/* Dashboard */}
        {dash.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {dash.kind === "error" && (
          <Message tone="danger" title="접근할 수 없습니다">
            {dash.code === "FORBIDDEN" || dash.code === "UNAUTHENTICATED" ? "운영자 권한이 필요합니다." : "대시보드를 불러오지 못했습니다."}
          </Message>
        )}
        {dash.kind === "success" && (
          <>
            <div className="flex flex-wrap gap-3">
              <StatusBadge tone="neutral">계정 {dash.data.accounts.total}</StatusBadge>
              <StatusBadge tone="neutral">지원자(고유) {dash.data.applicants.uniqueAccounts}</StatusBadge>
              <span className="text-[15px] text-ink-strong/70">측정 {new Date(dash.data.measuredAt).toLocaleString("ko-KR")}</span>
            </div>
            <div className="mt-4 overflow-x-auto rounded-md border border-line bg-white">
              <table className="w-full min-w-[820px] text-left text-[16px]">
                <thead><tr className="border-b border-line bg-surface text-ink-strong">
                  <th className="px-4 py-3 font-semibold">공모</th><th className="px-4 py-3 font-semibold">단계</th>
                  <th className="px-4 py-3 font-semibold">접수</th><th className="px-4 py-3 font-semibold">결제완료</th>
                  <th className="px-4 py-3 font-semibold">검토필요</th><th className="px-4 py-3 font-semibold">승인액(총)</th>
                </tr></thead>
                <tbody>
                  {dash.data.competitions.items.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink-strong">{c.title?.ko || c.title?.en || c.slug}</td>
                      <td className="px-4 py-3 text-ink-strong">{c.phase}</td>
                      <td className="px-4 py-3 text-ink-strong">{c.entries.received}/{c.entries.total}</td>
                      <td className="px-4 py-3 text-ink-strong">{c.payments.succeeded}</td>
                      <td className="px-4 py-3">{c.payments.needsReview > 0 ? <StatusBadge tone="warning">{c.payments.needsReview}</StatusBadge> : <span className="text-ink-strong">0</span>}</td>
                      <td className="px-4 py-3 text-ink-strong">{money(c.payments.succeededAmountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[15px] text-ink-strong/70">승인액은 환불 전 총승인액이며 정산 매출이 아닙니다.</p>
          </>
        )}

        {/* Per-competition health + reviews */}
        <div className="mt-10">
          <label className="block max-w-sm">
            <span className="text-[16px] font-semibold text-ink-strong">공모별 결제 상세</span>
            <Select value={compId} onChange={(e) => pick(e.target.value)} className="mt-1">
              <option value="">— 선택 —</option>
              {comps.map((c) => <option key={c.id} value={c.id}>{c.slug}</option>)}
            </Select>
          </label>

          {detailErr && <Message tone="danger" className="mt-4" title="오류">{detailErr}</Message>}

          {health && (
            <div className="mt-4 rounded-2xl border border-line bg-white p-6">
              <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">결제 건강도 (payment-health)</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone="neutral">주문 {health.orders.total}</StatusBadge>
                <StatusBadge tone="success">완료 {health.orders.succeeded}</StatusBadge>
                <StatusBadge tone="warning">대기 {health.orders.pending}</StatusBadge>
                <StatusBadge tone="danger">실패 {health.orders.failed}</StatusBadge>
                <StatusBadge tone="warning">검토필요 {health.orders.needsReview}</StatusBadge>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge tone="neutral">복구대기 {health.recovery.pending}</StatusBadge>
                <StatusBadge tone="neutral">진행 {health.recovery.running}</StatusBadge>
                <StatusBadge tone="danger">지연 {health.recovery.stalled}</StatusBadge>
                <StatusBadge tone="warning">기한도래 {health.recovery.due}</StatusBadge>
              </div>
            </div>
          )}

          {reviews && (
            <div className="mt-6 rounded-2xl border border-line bg-white p-6">
              <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">검토 필요 주문 (payment-reviews)</h3>
              {reviews.length === 0 ? (
                <p className="mt-3 text-[16px] text-ink-strong">검토가 필요한 주문이 없습니다.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {reviews.map((r) => (
                    <ReviewRow key={r.orderId} competitionId={compId} r={r} onDone={() => loadDetail(compId)} />
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[15px] text-ink-strong/70">조치는 서버가 제공한 allowedActions에만 표시됩니다. 완료 결제 자체는 이 화면에서 임의 변경하지 않으며, 처리 후 원장을 재조회합니다.</p>
            </div>
          )}

          {compId && health && <RefundPanel competitionId={compId} />}
        </div>
      </section>
    </AdminShell>
  );
}
