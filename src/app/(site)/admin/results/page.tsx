"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, Select, StatusBadge } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  listAdminCompetitions, getAdminCompetition,
  publishResultsRound, issueCertificates,
  type AdminCompetitionRef,
} from "@/lib/api/ops";

// Result publication + certificate issue (LIVE, organizer). Two rounds:
// official_selection is the first announcement; finalist is published after
// finalist decisions are set on already-published official_selection entries.
// The server enforces all preconditions (decisions complete, deadline passed,
// no payment-review submitted entries, retention policy). This screen only
// triggers the guarded actions and surfaces the result — a click is not success
// until the server returns it. Certificate issue is a reservation (202/pending);
// the PDF worker completes it separately.

const field = "w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";

export default function AdminResultsPage() {
  const [comps, setComps] = useState<AdminCompetitionRef[]>([]);
  const [compId, setCompId] = useState("");
  const [revision, setRevision] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // certificate issue form
  const [certStage, setCertStage] = useState<"official_selection" | "finalist">("official_selection");
  const [entryIdsText, setEntryIdsText] = useState("");

  useEffect(() => {
    let alive = true;
    listAdminCompetitions().then((r) => { if (alive && r.kind === "success") setComps(r.data); });
    return () => { alive = false; };
  }, []);

  const pick = async (id: string) => {
    setCompId(id); setRevision(null); setLoadErr(null); setNotice(null); setError(null);
    if (!id) return;
    const r = await getAdminCompetition(id);
    if (r.kind === "success") setRevision(r.data.revision);
    else setLoadErr(r.kind === "error" ? r.message : "공모를 불러오지 못했습니다.");
  };

  const publish = async (round: "official_selection" | "finalist") => {
    if (revision == null) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await publishResultsRound(compId, round, revision);
    setBusy(false);
    if (r.kind === "success") {
      setNotice(`${round === "official_selection" ? "Official Selection" : "Finalist"} 발표 완료 · 선정 ${r.data.selectedCount}/${r.data.eligibleCount}건. 결과 revision ${r.data.resultingRevision}.`);
      pick(compId);
    } else setError(r.kind === "error" ? r.message : "발표 실패");
  };

  const issue = async () => {
    const ids = entryIdsText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) { setError("접수 ID(UUID)를 한 개 이상 입력하세요."); return; }
    setBusy(true); setError(null); setNotice(null);
    const r = await issueCertificates(compId, { entryIds: ids, stage: certStage, actionId: crypto.randomUUID() });
    setBusy(false);
    if (r.kind === "success") {
      const issued = r.data.items.filter((i) => i.state === "issued").length;
      const pending = r.data.items.filter((i) => i.state === "pending").length;
      setNotice(`인증서 예약: 요청 ${r.data.requested}건 · 발급 ${issued} · 대기 ${pending}(202/pending은 PDF 발급 완료가 아님).`);
      setEntryIdsText("");
    } else setError(r.kind === "error" ? r.message : "발급 실패");
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="결과 발표·인증서" crumbs={[{ label: "관리자", href: "/admin" }, { label: "결과·인증서" }]} />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">결과 발표·인증서는 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}

        <label className="block max-w-sm">
          <span className="text-[16px] font-semibold text-ink-strong">공모 선택</span>
          <Select value={compId} onChange={(e) => pick(e.target.value)} className="mt-1">
            <option value="">— 선택 —</option>
            {comps.map((c) => <option key={c.id} value={c.id}>{c.slug}</option>)}
          </Select>
        </label>
        {loadErr && <Message tone="danger" className="mt-4" title="오류">{loadErr}</Message>}

        {compId && revision != null && (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusBadge tone="neutral">공모 revision {revision}</StatusBadge>
            </div>

            {/* Result rounds */}
            <div className="mt-4 rounded-2xl border border-line bg-white p-6">
              <h3 className="font-title text-[18px] font-bold text-ink-strong">결과 발표</h3>
              <p className="mt-2 text-[15px] text-ink-strong/70">
                모든 접수 심사 결정 완료, 결제 검토 중 접수 없음, 마감 경과, 보관 정책 설정이 충족되어야 서버가 발표를 허용합니다. 1차는 Official Selection만 공개(finalist는 내부), 이후 finalist 결정을 갱신해 2차 발표합니다.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => publish("official_selection")} disabled={busy}>1차 발표 (Official Selection)</Button>
                <Button variant="outline" onClick={() => publish("finalist")} disabled={busy}>2차 발표 (Finalist)</Button>
              </div>
            </div>

            {/* Certificate issue */}
            <div className="mt-6 rounded-2xl border border-line bg-white p-6">
              <h3 className="font-title text-[18px] font-bold text-ink-strong">인증서 발급</h3>
              <p className="mt-2 text-[15px] text-ink-strong/70">공개된 결과 증거가 있는 접수에만 발급을 예약합니다(1~100건). 202/pending은 예약이며, PDF는 내부 작업자가 발급을 완료합니다.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
                <label className="block"><span className="text-[15px] font-semibold text-ink-strong">단계</span>
                  <Select value={certStage} onChange={(e) => setCertStage(e.target.value as "official_selection" | "finalist")} className="mt-1">
                    <option value="official_selection">Official Selection</option>
                    <option value="finalist">Finalist</option>
                  </Select>
                </label>
                <label className="block"><span className="text-[15px] font-semibold text-ink-strong">접수 ID (UUID, 공백/줄바꿈/쉼표 구분)</span>
                  <textarea className={`${field} mt-1 h-24`} value={entryIdsText} onChange={(e) => setEntryIdsText(e.target.value)} placeholder="예: 6d55fef7-... (여러 개 가능)" />
                </label>
              </div>
              <Button className="mt-3" onClick={issue} disabled={busy}>인증서 발급 예약</Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
