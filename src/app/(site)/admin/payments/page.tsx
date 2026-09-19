"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Message, StatusBadge, Select, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  getAdminDashboard, getPaymentHealth, listPaymentReviews, listAdminCompetitions,
  type AdminDashboard, type PaymentHealth, type PaymentReview, type AdminCompetitionRef,
} from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";

// Payment operations (read; LIVE, organizer). Dashboard + per-competition health
// and orders needing review. Approved amounts are gross (pre-refund) — not
// settlement revenue. Mutations (accept-late/requeue/refund) are follow-up.

const money = (m: number) => `€${(m / 100).toFixed(0)}`;
const PAY_TONE: Record<string, Tone> = { pending: "warning", succeeded: "success", failed: "danger", cancelled: "danger", expired: "neutral" };

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

  const pick = async (id: string) => {
    setCompId(id); setHealth(null); setReviews(null); setDetailErr(null);
    if (!id) return;
    const [h, rv] = await Promise.all([getPaymentHealth(id), listPaymentReviews(id)]);
    if (h.kind === "success") setHealth(h.data); else if (h.kind === "error") setDetailErr(h.message);
    if (rv.kind === "success") setReviews([...rv.data.items]); else if (rv.kind === "empty") setReviews([]);
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="결제 운영" crumbs={[{ label: "관리자", href: "/admin" }, { label: "결제 운영" }]} />
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
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
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
              <h3 className="font-title text-[18px] font-bold text-ink-strong">결제 건강도 (payment-health)</h3>
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
              <h3 className="font-title text-[18px] font-bold text-ink-strong">검토 필요 주문 (payment-reviews)</h3>
              {reviews.length === 0 ? (
                <p className="mt-3 text-[16px] text-ink-strong">검토가 필요한 주문이 없습니다.</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {reviews.map((r) => (
                    <li key={r.orderId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2 last:border-0">
                      <StatusBadge tone={PAY_TONE[r.state] ?? "neutral"}>{r.state}</StatusBadge>
                      <span className="text-[16px] font-semibold text-ink-strong">{money(r.money.amountMinor)}</span>
                      <span className="text-[15px] text-ink-strong/70">{r.reviewReasons.join(", ")}</span>
                      <span className="ml-auto text-[15px] text-ink-strong/70">{r.allowedActions.join(" · ") || "—"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[15px] text-ink-strong/70">지연 승인 확정·복구 재큐·환불은 서버 API + 권한으로 처리됩니다(후속). 완료 결제는 이 화면에서 변경하지 않습니다.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
