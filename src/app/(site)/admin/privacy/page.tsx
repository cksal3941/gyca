"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Select, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  listAdminPrivacyRequests,
  reviewPrivacyRequest,
  type AdminPrivacyRequest,
} from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";
import type { Page } from "@/contracts";

// Privacy requests (account closure + data erasure) — LIVE, organizer.
// Workflow: submitted → start_review → (place_retention_hold ⇄ resume_review) →
// approve_for_execution. Approving execution is irreversible (leads to erasure);
// it is gated behind an explicit confirm. Retention holds and approvals require a
// reason code + an evidence reference (audit trail).

const STATE_VIEW: Record<AdminPrivacyRequest["state"], { label: string; tone: Tone }> = {
  submitted: { label: "접수됨", tone: "info" },
  under_review: { label: "검토 중", tone: "warning" },
  retention_hold: { label: "보존 보류", tone: "warning" },
  approved_for_execution: { label: "파기 승인", tone: "danger" },
  cancelled: { label: "취소됨", tone: "neutral" },
};
const HOLD_REASONS = [
  { value: "LEGAL_RETENTION", label: "법적 보존 의무" },
  { value: "PAYMENT_RECORD_RETENTION", label: "결제 기록 보존" },
  { value: "CONTEST_EVIDENCE_RETENTION", label: "공모 증빙 보존" },
] as const;
const field = "w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";

export default function AdminPrivacyPage() {
  const [state, setState] = useState<RequestState<Page<AdminPrivacyRequest>>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // shared audit inputs used by hold / approve
  const [holdReason, setHoldReason] = useState<string>("LEGAL_RETENTION");
  const [evidence, setEvidence] = useState("");
  // approval confirm gate (irreversible → erasure)
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listAdminPrivacyRequests().then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); };

  const act = async (it: AdminPrivacyRequest, decision: "start_review" | "resume_review" | "place_retention_hold" | "approve_for_execution") => {
    setBusy(true); setError(null); setNotice(null);
    const actionId = crypto.randomUUID();
    let input;
    if (decision === "start_review" || decision === "resume_review") {
      input = { actionId, expectedRevision: it.revision, decision };
    } else if (decision === "place_retention_hold") {
      if (!evidence.trim()) { setBusy(false); setError("보존 보류에는 증거 참조가 필요합니다."); return; }
      input = { actionId, expectedRevision: it.revision, decision, reasonCode: holdReason as "LEGAL_RETENTION" | "PAYMENT_RECORD_RETENTION" | "CONTEST_EVIDENCE_RETENTION", evidenceReference: evidence.trim() };
    } else {
      if (!evidence.trim()) { setBusy(false); setError("파기 승인에는 증거 참조가 필요합니다."); return; }
      input = { actionId, expectedRevision: it.revision, decision, reasonCode: "NO_RETENTION_BLOCK" as const, evidenceReference: evidence.trim() };
    }
    const res = await reviewPrivacyRequest(it.id, input);
    setBusy(false); setConfirmId(null);
    if (res.kind === "success") {
      setNotice({
        start_review: "검토를 시작했습니다.", resume_review: "검토를 재개했습니다.",
        place_retention_hold: "보존 보류로 전환했습니다.", approve_for_execution: "파기를 승인했습니다.",
      }[decision]);
      setEvidence("");
      reload();
    } else setError(res.kind === "error" ? res.message : "처리 실패");
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="개인정보 요청 검토" crumbs={[{ label: "관리자", href: "/admin" }, { label: "개인정보 요청" }]} />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">개인정보 요청 검토는 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}

        {/* audit inputs for hold / approve */}
        <div className="mb-6 rounded-2xl border border-dashed border-field bg-canvas p-4">
          <p className="text-[15px] font-semibold text-ink-strong">보류/승인 감사 입력 (아래 목록 버튼에 사용)</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
            <Select value={holdReason} onChange={(e) => setHoldReason(e.target.value)}>
              {HOLD_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            <input className={field} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="증거 참조 (문서 ID·링크). 보류/승인 시 필수" />
          </div>
          <p className="mt-2 text-[15px] text-ink-strong/70">사유 코드는 보존 보류에만 적용됩니다. 파기 승인은 보존 사유 없음(NO_RETENTION_BLOCK)으로 기록됩니다.</p>
        </div>

        {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {state.kind === "empty" && <p className="text-[16px] text-ink-strong">대기 중인 개인정보 요청이 없습니다.</p>}
        {state.kind === "error" && (
          <Message tone="danger" title="불러오지 못했습니다">
            {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED" ? "운영자 권한이 필요합니다." : "목록을 불러오지 못했습니다."}
          </Message>
        )}
        {state.kind === "success" && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[860px] text-left text-[16px]">
              <thead>
                <tr className="border-b border-line bg-surface text-ink-strong">
                  <th className="px-5 py-3 font-semibold">요청자</th>
                  <th className="px-5 py-3 font-semibold">상태</th>
                  <th className="px-5 py-3 font-semibold">최근 전이</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((it) => (
                  <tr key={it.id} className="border-b border-line last:border-0 align-top">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-ink-strong">{it.requester.email}</div>
                      <div className="text-[15px] text-ink-strong/70">{it.requester.accountId}</div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge tone={STATE_VIEW[it.state].tone}>{STATE_VIEW[it.state].label}</StatusBadge></td>
                    <td className="px-5 py-4 text-[15px] text-ink-strong">
                      <div>{it.lastTransition.reasonCode}</div>
                      {it.lastTransition.evidenceReference && <div className="text-ink-strong/70">증거: {it.lastTransition.evidenceReference}</div>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {it.allowedActions.includes("start_review") && <Button size="sm" onClick={() => act(it, "start_review")} disabled={busy}>검토 시작</Button>}
                        {it.allowedActions.includes("resume_review") && <Button size="sm" onClick={() => act(it, "resume_review")} disabled={busy}>검토 재개</Button>}
                        {it.allowedActions.includes("place_retention_hold") && <Button size="sm" variant="outline" onClick={() => act(it, "place_retention_hold")} disabled={busy}>보존 보류</Button>}
                        {it.allowedActions.includes("approve_for_execution") && (
                          confirmId === it.id ? (
                            <span className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/5 px-2 py-1">
                              <span className="text-[15px] font-semibold text-ink-strong">파기 승인?</span>
                              <Button size="sm" onClick={() => act(it, "approve_for_execution")} disabled={busy}>확정</Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirmId(null)} disabled={busy}>취소</Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setConfirmId(it.id); setError(null); setNotice(null); }} disabled={busy}>파기 승인…</Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
