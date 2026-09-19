"use client";

import { useEffect, useState } from "react";
import { Button, Message, Textarea } from "@/components/ds";
import {
  getCompetitionPresentation,
  updateCompetitionPresentation,
  type AdminCompetitionPresentation,
} from "@/lib/api/ops";
import { CompetitionPresentationSchema } from "@/contracts/competition-presentation";

// Public card presentation copy (summary/category/city/cover) — LIVE, organizer.
// Separate GET/PUT with its own revision and save button; it does NOT touch the
// competition's fee/schedule/policy. City is only shown publicly once the
// exhibition venue is approved (server-gated). Cover is optional.

const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";
const label = "text-[16px] font-semibold text-ink-strong";

// A localized copy pair → null when both blank; both required if either is filled.
function pair(en: string, ko: string): { en: string; ko: string } | null | "partial" {
  const e = en.trim(), k = ko.trim();
  if (e === "" && k === "") return null;
  if (e === "" || k === "") return "partial";
  return { en: e, ko: k };
}

export default function PresentationEditor({ competitionId }: { competitionId: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sumEn, setSumEn] = useState(""); const [sumKo, setSumKo] = useState("");
  const [catEn, setCatEn] = useState(""); const [catKo, setCatKo] = useState("");
  const [cityEn, setCityEn] = useState(""); const [cityKo, setCityKo] = useState("");
  const [coverOn, setCoverOn] = useState(false);
  const [coverSrc, setCoverSrc] = useState("");
  const [coverAltEn, setCoverAltEn] = useState(""); const [coverAltKo, setCoverAltKo] = useState("");
  const [evidence, setEvidence] = useState("");

  const applyData = (d: AdminCompetitionPresentation) => {
    setRevision(d.revision);
    const c = d.content;
    setSumEn(c.summary?.en ?? ""); setSumKo(c.summary?.ko ?? "");
    setCatEn(c.category?.en ?? ""); setCatKo(c.category?.ko ?? "");
    setCityEn(c.city?.en ?? ""); setCityKo(c.city?.ko ?? "");
    setCoverOn(c.cover != null); setCoverSrc(c.cover?.src ?? "");
    setCoverAltEn(c.cover?.alt.en ?? ""); setCoverAltKo(c.cover?.alt.ko ?? "");
  };

  useEffect(() => {
    let alive = true;
    getCompetitionPresentation(competitionId).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { applyData(r.data); setPhase("ready"); }
      else setPhase("error");
    });
    return () => { alive = false; };
  }, [competitionId, reloadKey]);

  const save = async () => {
    setBusy(true); setError(null); setNotice(null);
    const summary = pair(sumEn, sumKo), category = pair(catEn, catKo), city = pair(cityEn, cityKo);
    if (summary === "partial" || category === "partial" || city === "partial") {
      setBusy(false); setError("요약·분류·도시는 EN/KO를 모두 입력하거나 모두 비워 주세요."); return;
    }
    if (evidence.trim() === "") { setBusy(false); setError("저장에는 내부 기록 참조(evidence)가 필요합니다."); return; }
    const rawContent = {
      summary, category, city,
      cover: coverOn && coverSrc.trim() !== ""
        ? { src: coverSrc.trim(), alt: { en: coverAltEn.trim(), ko: coverAltKo.trim() }, caption: null }
        : null,
    };
    const parsed = CompetitionPresentationSchema.safeParse(rawContent);
    if (!parsed.success) {
      setBusy(false);
      setError(`입력값 확인: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
      return;
    }
    const res = await updateCompetitionPresentation(competitionId, {
      expectedRevision: revision, content: parsed.data, evidenceReference: evidence.trim(),
    });
    setBusy(false);
    if (res.kind === "success") { applyData(res.data); setEvidence(""); setNotice("표시 정보를 저장했습니다. 공개 공모에는 즉시 반영됩니다."); }
    else if (res.kind === "error" && res.code === "REVISION_CONFLICT") {
      setError("다른 사람이 먼저 저장했습니다. 최신 내용을 불러왔으니 확인 후 다시 저장하세요.");
      setReloadKey((k) => k + 1);
    } else setError(res.kind === "error" ? res.message : "저장 실패");
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="font-title text-[18px] font-bold text-ink-strong">공개 카드 표시 정보</h3>
      <p className="mt-2 text-[15px] text-ink-strong/70">공모전 목록 카드에 노출되는 요약·분류·도시·표지입니다. 참가비·일정·정책과 별개로 저장되며, 공개 공모에는 즉시 반영됩니다. <b>도시는 전시 장소가 승인된 뒤에만 공개</b>됩니다(승인 전 입력해도 공개 응답에서는 숨김).</p>

      {phase === "loading" && <p className="mt-4 text-[16px] text-ink-strong">불러오는 중…</p>}
      {phase === "error" && (
        <Message tone="danger" className="mt-4" title="불러오지 못했습니다">
          운영자 권한이 필요하거나 일시적 오류입니다.
          <div className="mt-3"><Button size="sm" onClick={() => { setPhase("loading"); setReloadKey((k) => k + 1); }}>다시 시도</Button></div>
        </Message>
      )}

      {phase === "ready" && (
        <>
          {notice && <Message tone="success" className="mt-4">{notice}</Message>}
          {error && <Message tone="danger" className="mt-4" title="오류">{error}</Message>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className={label}>요약 EN</span><Textarea rows={2} value={sumEn} onChange={(e) => setSumEn(e.target.value)} className="mt-1" /></label>
            <label className="block sm:col-span-2"><span className={label}>요약 KO</span><Textarea rows={2} value={sumKo} onChange={(e) => setSumKo(e.target.value)} className="mt-1" /></label>
            <label className="block"><span className={label}>분류 EN</span><input className={field} value={catEn} onChange={(e) => setCatEn(e.target.value)} placeholder="Book awards" /></label>
            <label className="block"><span className={label}>분류 KO</span><input className={field} value={catKo} onChange={(e) => setCatKo(e.target.value)} placeholder="도서 공모전" /></label>
            <label className="block"><span className={label}>도시 EN (승인 후 공개)</span><input className={field} value={cityEn} onChange={(e) => setCityEn(e.target.value)} placeholder="Leipzig" /></label>
            <label className="block"><span className={label}>도시 KO (승인 후 공개)</span><input className={field} value={cityKo} onChange={(e) => setCityKo(e.target.value)} placeholder="라이프치히" /></label>
          </div>

          <label className="mt-4 flex items-center gap-2">
            <input type="checkbox" checked={coverOn} onChange={(e) => setCoverOn(e.target.checked)} className="h-4 w-4 accent-brand-blue" />
            <span className={label}>표지 이미지 포함</span>
          </label>
          {coverOn && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className={label}>이미지 경로/URL (사이트 경로 또는 https)</span><input className={field} value={coverSrc} onChange={(e) => setCoverSrc(e.target.value)} placeholder="/images/contests/leipzig-2027.jpg" /></label>
              <label className="block"><span className={label}>대체 텍스트 EN</span><input className={field} value={coverAltEn} onChange={(e) => setCoverAltEn(e.target.value)} /></label>
              <label className="block"><span className={label}>대체 텍스트 KO</span><input className={field} value={coverAltKo} onChange={(e) => setCoverAltKo(e.target.value)} /></label>
            </div>
          )}

          <label className="mt-4 block sm:max-w-lg"><span className={label}>내부 기록 참조 (evidence, 필수)</span>
            <input className={field} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="예: internal-record:card-copy-reviewed" />
          </label>
          <Button className="mt-4" onClick={save} disabled={busy}>{busy ? "저장 중…" : "표시 정보 저장"}</Button>
        </>
      )}
    </div>
  );
}
