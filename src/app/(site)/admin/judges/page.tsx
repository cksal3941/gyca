"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Select } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  listJudges, updateJudge, listAdminCompetitions, getReviewRubric, updateReviewRubric,
  type JudgeAccount, type AdminCompetitionRef,
} from "@/lib/api/ops";

// Judge admin (LIVE, organizer): activate/deactivate judges and edit the
// per-competition review rubric (criteria + max scores).

type Crit = { id: string; label: string; description: string; maxScore: string };
const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";

export default function AdminJudgesPage() {
  const [judges, setJudges] = useState<JudgeAccount[] | null>(null);
  const [comps, setComps] = useState<AdminCompetitionRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // rubric editor
  const [compId, setCompId] = useState<string>("");
  const [rev, setRev] = useState<number | null>(null);
  const [version, setVersion] = useState("");
  const [editable, setEditable] = useState(false);
  const [criteria, setCriteria] = useState<Crit[]>([]);
  const [rubricLoaded, setRubricLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    listJudges().then((r) => { if (alive) { if (r.kind === "success") setJudges(r.data); else if (r.kind === "empty") setJudges([]); else setError(r.kind === "error" ? r.message : null); } });
    listAdminCompetitions().then((r) => { if (alive && r.kind === "success") setComps(r.data); });
    return () => { alive = false; };
  }, [reloadKey]);

  const toggleJudge = async (j: JudgeAccount) => {
    setBusy(true); setError(null); setNotice(null);
    const r = await updateJudge(j.userId, { expectedActive: j.active, active: !j.active, reason: j.active ? "비활성화" : "활성화" });
    setBusy(false);
    if (r.kind === "success") { setNotice("심사위원 상태를 변경했습니다."); setReloadKey((k) => k + 1); }
    else setError(r.kind === "error" ? r.message : "변경 실패");
  };

  const loadRubric = async (id: string) => {
    setCompId(id); setRubricLoaded(false); setError(null); setNotice(null);
    if (!id) return;
    const r = await getReviewRubric(id);
    if (r.kind === "success") {
      setRev(r.data.competitionRevision);
      setVersion(r.data.rubric?.version ?? "v1");
      setEditable(r.data.rubric?.editableAfterSubmit ?? false);
      setCriteria((r.data.rubric?.criteria ?? []).map((c) => ({ id: c.id, label: c.label, description: c.description, maxScore: String(c.maxScore) })));
      setRubricLoaded(true);
    } else setError(r.kind === "error" ? r.message : "채점기준을 불러오지 못했습니다.");
  };

  const saveRubric = async () => {
    if (!compId || rev === null) return;
    setBusy(true); setError(null); setNotice(null);
    const r = await updateReviewRubric(compId, {
      competitionRevision: rev,
      rubric: { version: version.trim() || "v1", editableAfterSubmit: editable,
        criteria: criteria.map((c) => ({ id: c.id.trim(), label: c.label.trim(), description: c.description.trim(), maxScore: Number(c.maxScore) || 0 })) },
    });
    setBusy(false);
    if (r.kind === "success") { setNotice("채점기준을 저장했습니다."); setRev(r.data.competitionRevision); }
    else setError(r.kind === "error" ? (r.code === "REVISION_CONFLICT" ? "다른 곳에서 먼저 변경되었습니다. 다시 불러오세요." : r.message) : "저장 실패");
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="심사 운영" crumbs={[{ label: "관리자", href: "/admin" }, { label: "심사 운영" }]} />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">심사 운영은 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}

        {/* Judges */}
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">심사위원</h2>
          {judges === null ? (
            <p className="mt-4 text-[16px] text-ink-strong">불러오는 중…</p>
          ) : judges.length === 0 ? (
            <p className="mt-4 text-[16px] text-ink-strong">등록된 심사위원이 없습니다.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[16px]">
                <thead><tr className="border-b border-line text-ink-strong">
                  <th className="py-2 font-semibold">이름</th><th className="py-2 font-semibold">이메일</th>
                  <th className="py-2 font-semibold">진행중</th><th className="py-2 font-semibold">상태</th><th className="py-2" />
                </tr></thead>
                <tbody>
                  {judges.map((j) => (
                    <tr key={j.userId} className="border-b border-line last:border-0">
                      <td className="py-3 font-semibold text-ink-strong">{j.name}</td>
                      <td className="py-3 text-ink-strong">{j.email}</td>
                      <td className="py-3 text-ink-strong">{j.unfinishedAssignments}</td>
                      <td className="py-3"><StatusBadge tone={j.active ? "success" : "neutral"}>{j.active ? "활성" : "비활성"}</StatusBadge></td>
                      <td className="py-3 text-right"><Button size="sm" variant="outline" disabled={busy} onClick={() => toggleJudge(j)}>{j.active ? "비활성화" : "활성화"}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[15px] text-ink-strong/70">심사위원 계정은 가입 후 운영자가 활성화합니다. 배정은 접수/블라인드 파일 준비 후 진행합니다.</p>
        </div>

        {/* Rubric */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">채점 기준</h2>
          <label className="mt-4 block max-w-sm">
            <span className="text-[16px] font-semibold text-ink-strong">공모 선택</span>
            <Select value={compId} onChange={(e) => loadRubric(e.target.value)} className="mt-1">
              <option value="">— 선택 —</option>
              {comps.map((c) => <option key={c.id} value={c.id}>{c.slug}</option>)}
            </Select>
          </label>

          {rubricLoaded && (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-[16px] font-semibold text-ink-strong">버전</span>
                  <input className={field} value={version} onChange={(e) => setVersion(e.target.value)} /></label>
                <label className="mt-6 flex items-center gap-2">
                  <input type="checkbox" checked={editable} onChange={(e) => setEditable(e.target.checked)} className="h-4 w-4 accent-brand-blue" />
                  <span className="text-[16px] text-ink-strong">제출 후 수정 허용</span>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-ink-strong">항목</h3>
                <Button size="sm" variant="outline" onClick={() => setCriteria((c) => [...c, { id: "", label: "", description: "", maxScore: "20" }])}>항목 추가</Button>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {criteria.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_5rem_auto]">
                    <input className={field} value={c.id} placeholder="id" onChange={(e) => setCriteria((v) => v.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} />
                    <input className={field} value={c.label} placeholder="이름" onChange={(e) => setCriteria((v) => v.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <input className={field} value={c.description} placeholder="설명" onChange={(e) => setCriteria((v) => v.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    <input className={field} type="number" min={1} max={100} value={c.maxScore} placeholder="배점" onChange={(e) => setCriteria((v) => v.map((x, j) => j === i ? { ...x, maxScore: e.target.value } : x))} />
                    <Button size="sm" variant="ghost" onClick={() => setCriteria((v) => v.filter((_, j) => j !== i))}>삭제</Button>
                  </div>
                ))}
              </div>
              <Button className="mt-4" onClick={saveRubric} disabled={busy}>{busy ? "저장 중…" : "채점기준 저장"}</Button>
              <p className="mt-3 text-[15px] text-ink-strong/70">배점은 서버가 심사 화면에 그대로 적용합니다(1~100).</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
