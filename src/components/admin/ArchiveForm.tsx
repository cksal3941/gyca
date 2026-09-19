"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Message, Select, Textarea } from "@/components/ds";
import { createProject, updateProject, type ArchiveAdminItem } from "@/lib/api/ops";
import {
  ArchiveContentSchema,
  ARCHIVE_SECTION_KINDS,
  type ArchiveSectionKind,
} from "@/contracts/project-archive";

// Completed-project archive editor (LIVE, organizer). Builds a valid
// ArchiveContentSchema payload: hero + 1..10 sections (unique kind/order). A
// "ready" section needs at least one piece of content. Editing a PUBLISHED
// project reverts it to draft (caller warns first). No file uploader — media is a
// public site path or HTTPS URL to an already-approved file.

const PROJECT_TYPES = ["art", "book", "composition", "performance", "interdisciplinary"] as const;
const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";
const label = "text-[15px] font-semibold text-ink-strong";

type Media = { src: string; altEn: string; altKo: string; capEn: string; capKo: string };
type Quote = { qEn: string; qKo: string; aEn: string; aKo: string };
type Stat = { lEn: string; lKo: string; vEn: string; vKo: string };
type Sec = {
  kind: ArchiveSectionKind; order: string; titleEn: string; titleKo: string;
  optional: boolean; status: "pending" | "ready"; noteEn: string; noteKo: string;
  introEn: string; introKo: string; gallery: Media[]; documents: Media[]; quotes: Quote[]; stats: Stat[];
};

const emptyMedia = (): Media => ({ src: "", altEn: "", altKo: "", capEn: "", capKo: "" });
const blankSection = (order: number): Sec => ({
  kind: "intro", order: String(order), titleEn: "", titleKo: "", optional: false, status: "ready",
  noteEn: "", noteKo: "", introEn: "", introKo: "", gallery: [], documents: [], quotes: [], stats: [],
});

// null when both blank; kept as {en,ko} otherwise (schema rejects one-sided).
const pair = (en: string, ko: string) => (en.trim() === "" && ko.trim() === "" ? null : { en: en.trim(), ko: ko.trim() });
const media = (m: Media) => ({ src: m.src.trim(), alt: { en: m.altEn.trim(), ko: m.altKo.trim() }, caption: pair(m.capEn, m.capKo) });

function fromContent(item: ArchiveAdminItem): { slug: string; projectType: string; completionYear: string; hero: {
  progEn: string; progKo: string; sumEn: string; sumKo: string; locEn: string; locKo: string; perEn: string; perKo: string;
  operatedEn: string; operatedKo: string; imgSrc: string; imgAltEn: string; imgAltKo: string; }; sections: Sec[] } {
  const c = item.content;
  return {
    slug: item.slug, projectType: c.projectType, completionYear: c.completionYear == null ? "" : String(c.completionYear),
    hero: {
      progEn: c.hero.program.en, progKo: c.hero.program.ko, sumEn: c.hero.summary.en, sumKo: c.hero.summary.ko,
      locEn: c.hero.location?.en ?? "", locKo: c.hero.location?.ko ?? "", perEn: c.hero.period?.en ?? "", perKo: c.hero.period?.ko ?? "",
      operatedEn: c.hero.operated.map((o) => o.en).join(" | "), operatedKo: c.hero.operated.map((o) => o.ko).join(" | "),
      imgSrc: c.hero.image?.src ?? "", imgAltEn: c.hero.image?.alt.en ?? "", imgAltKo: c.hero.image?.alt.ko ?? "",
    },
    sections: c.sections.map((s) => ({
      kind: s.kind, order: String(s.order), titleEn: s.title.en, titleKo: s.title.ko, optional: s.optional,
      status: s.status, noteEn: s.pendingNote?.en ?? "", noteKo: s.pendingNote?.ko ?? "",
      introEn: s.intro?.en ?? "", introKo: s.intro?.ko ?? "",
      gallery: s.gallery.map((m) => ({ src: m.src, altEn: m.alt.en, altKo: m.alt.ko, capEn: m.caption?.en ?? "", capKo: m.caption?.ko ?? "" })),
      documents: s.documents.map((m) => ({ src: m.src, altEn: m.alt.en, altKo: m.alt.ko, capEn: m.caption?.en ?? "", capKo: m.caption?.ko ?? "" })),
      quotes: s.quotes.map((q) => ({ qEn: q.quote.en, qKo: q.quote.ko, aEn: q.attribution.en, aKo: q.attribution.ko })),
      stats: s.stats.map((st) => ({ lEn: st.label.en, lKo: st.label.ko, vEn: st.value.en, vKo: st.value.ko })),
    })),
  };
}

export default function ArchiveForm({ mode, initial }: { mode: "create" | "edit"; initial: ArchiveAdminItem | null }) {
  const router = useRouter();
  const seed = initial ? fromContent(initial) : null;

  const [slug, setSlug] = useState(seed?.slug ?? "");
  const [projectType, setProjectType] = useState(seed?.projectType ?? "art");
  const [completionYear, setCompletionYear] = useState(seed?.completionYear ?? "");
  const [progEn, setProgEn] = useState(seed?.hero.progEn ?? ""); const [progKo, setProgKo] = useState(seed?.hero.progKo ?? "");
  const [sumEn, setSumEn] = useState(seed?.hero.sumEn ?? ""); const [sumKo, setSumKo] = useState(seed?.hero.sumKo ?? "");
  const [locEn, setLocEn] = useState(seed?.hero.locEn ?? ""); const [locKo, setLocKo] = useState(seed?.hero.locKo ?? "");
  const [perEn, setPerEn] = useState(seed?.hero.perEn ?? ""); const [perKo, setPerKo] = useState(seed?.hero.perKo ?? "");
  const [operatedEn, setOperatedEn] = useState(seed?.hero.operatedEn ?? ""); const [operatedKo, setOperatedKo] = useState(seed?.hero.operatedKo ?? "");
  const [imgSrc, setImgSrc] = useState(seed?.hero.imgSrc ?? ""); const [imgAltEn, setImgAltEn] = useState(seed?.hero.imgAltEn ?? ""); const [imgAltKo, setImgAltKo] = useState(seed?.hero.imgAltKo ?? "");
  const [sections, setSections] = useState<Sec[]>(seed?.sections ?? [blankSection(1)]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const patchSec = (i: number, p: Partial<Sec>) => setSections((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const buildContent = () => {
    const operatedEnArr = operatedEn.split("|").map((s) => s.trim()).filter(Boolean);
    const operatedKoArr = operatedKo.split("|").map((s) => s.trim()).filter(Boolean);
    const operated = operatedEnArr.map((en, i) => ({ en, ko: operatedKoArr[i] ?? en }));
    return {
      projectType,
      completionYear: completionYear.trim() === "" ? null : Number(completionYear),
      hero: {
        program: { en: progEn.trim(), ko: progKo.trim() }, summary: { en: sumEn.trim(), ko: sumKo.trim() },
        location: pair(locEn, locKo), period: pair(perEn, perKo), operated,
        image: imgSrc.trim() === "" ? null : { src: imgSrc.trim(), alt: { en: imgAltEn.trim(), ko: imgAltKo.trim() }, caption: null },
      },
      sections: sections.map((s) => ({
        kind: s.kind, order: Number(s.order) || 1, title: { en: s.titleEn.trim(), ko: s.titleKo.trim() },
        optional: s.optional, pendingNote: pair(s.noteEn, s.noteKo), status: s.status,
        intro: pair(s.introEn, s.introKo),
        gallery: s.gallery.filter((m) => m.src.trim() !== "").map(media),
        documents: s.documents.filter((m) => m.src.trim() !== "").map(media),
        quotes: s.quotes.filter((q) => q.qEn.trim() || q.qKo.trim()).map((q) => ({ quote: { en: q.qEn.trim(), ko: q.qKo.trim() }, attribution: { en: q.aEn.trim(), ko: q.aKo.trim() } })),
        stats: s.stats.filter((st) => st.vEn.trim() || st.vKo.trim()).map((st) => ({ label: { en: st.lEn.trim(), ko: st.lKo.trim() }, value: { en: st.vEn.trim(), ko: st.vKo.trim() } })),
      })),
    };
  };

  const save = async () => {
    setBusy(true); setError(null); setNotice(null);
    const parsed = ArchiveContentSchema.safeParse(buildContent());
    if (!parsed.success) {
      setBusy(false);
      setError(`입력값 확인: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
      return;
    }
    const res = mode === "create"
      ? await createProject({ actionId: crypto.randomUUID(), slug: slug.trim(), content: parsed.data })
      : await updateProject(initial!.id, { actionId: crypto.randomUUID(), expectedRevision: initial!.revision, content: parsed.data });
    setBusy(false);
    if (res.kind === "success") {
      if (mode === "create") { router.push(`/admin/content/projects/${res.data.id}`); return; }
      setNotice("저장했습니다. 발행되어 있던 프로젝트는 초안으로 돌아가 공개에서 내려갑니다. 다시 확인 후 발행하세요.");
      router.refresh();
    } else if (res.kind === "error" && res.code === "REVISION_CONFLICT") {
      setError("다른 사람이 먼저 저장했습니다. 목록에서 최신 내용을 다시 불러오세요.");
    } else setError(res.kind === "error" ? res.message : "저장 실패");
  };

  return (
    <div className="flex flex-col gap-6">
      {notice && <Message tone="success">{notice}</Message>}
      {error && <Message tone="danger" title="오류">{error}</Message>}
      {mode === "edit" && (
        <Message tone="info" title="발행 콘텐츠 수정 주의">발행된 프로젝트를 저장하면 <b>즉시 초안으로 돌아가 공개에서 사라집니다</b>. 병행 초안은 없습니다. 저장 후 자료를 다시 확인해 발행하세요.</Message>
      )}

      {/* 기본 정보 + hero */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <h3 className="font-title text-[18px] font-bold text-ink-strong">기본 정보</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block"><span className={label}>슬러그</span><input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={mode === "edit"} placeholder="klimt-villa-2024" /></label>
          <label className="block"><span className={label}>유형</span>
            <Select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="mt-1">{PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select>
          </label>
          <label className="block"><span className={label}>완료 연도 (선택)</span><input className={field} type="number" min={1900} max={2100} value={completionYear} onChange={(e) => setCompletionYear(e.target.value)} /></label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={label}>프로그램명 EN</span><input className={field} value={progEn} onChange={(e) => setProgEn(e.target.value)} /></label>
          <label className="block"><span className={label}>프로그램명 KO</span><input className={field} value={progKo} onChange={(e) => setProgKo(e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={label}>요약 EN</span><Textarea rows={2} value={sumEn} onChange={(e) => setSumEn(e.target.value)} className="mt-1" /></label>
          <label className="block sm:col-span-2"><span className={label}>요약 KO</span><Textarea rows={2} value={sumKo} onChange={(e) => setSumKo(e.target.value)} className="mt-1" /></label>
          <label className="block"><span className={label}>장소 EN (선택)</span><input className={field} value={locEn} onChange={(e) => setLocEn(e.target.value)} /></label>
          <label className="block"><span className={label}>장소 KO (선택)</span><input className={field} value={locKo} onChange={(e) => setLocKo(e.target.value)} /></label>
          <label className="block"><span className={label}>기간 EN (선택)</span><input className={field} value={perEn} onChange={(e) => setPerEn(e.target.value)} /></label>
          <label className="block"><span className={label}>기간 KO (선택)</span><input className={field} value={perKo} onChange={(e) => setPerKo(e.target.value)} /></label>
          <label className="block"><span className={label}>주관 EN (| 로 구분)</span><input className={field} value={operatedEn} onChange={(e) => setOperatedEn(e.target.value)} placeholder="GYCA | Partner" /></label>
          <label className="block"><span className={label}>주관 KO (| 로 구분)</span><input className={field} value={operatedKo} onChange={(e) => setOperatedKo(e.target.value)} placeholder="GYCA | 파트너" /></label>
          <label className="block"><span className={label}>대표 이미지 경로/URL (선택)</span><input className={field} value={imgSrc} onChange={(e) => setImgSrc(e.target.value)} placeholder="/media/... 또는 https://" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className={label}>이미지 대체 EN</span><input className={field} value={imgAltEn} onChange={(e) => setImgAltEn(e.target.value)} /></label>
            <label className="block"><span className={label}>이미지 대체 KO</span><input className={field} value={imgAltKo} onChange={(e) => setImgAltKo(e.target.value)} /></label>
          </div>
        </div>
      </div>

      {/* 섹션 */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-title text-[18px] font-bold text-ink-strong">섹션 (1~10)</h3>
          <Button size="sm" variant="outline" disabled={sections.length >= 10} onClick={() => setSections((v) => [...v, blankSection(v.length + 1)])}>섹션 추가</Button>
        </div>
        <p className="mt-2 text-[15px] text-ink-strong/70">종류·순서는 중복 불가. <b>ready</b> 섹션은 최소 1개의 콘텐츠(소개/갤러리/문서/인용/통계)가 필요합니다. 발행하려면 ready 섹션이 하나 이상 있어야 합니다. 미디어는 공개 승인된 사이트 경로 또는 https URL만 가능합니다.</p>
        <div className="mt-4 flex flex-col gap-6">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[16px] font-bold text-ink-strong">섹션 {i + 1}</h4>
                <Button size="sm" variant="ghost" onClick={() => setSections((v) => v.filter((_, j) => j !== i))} disabled={sections.length <= 1}>삭제</Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_0.6fr_1fr]">
                <label className="block"><span className={label}>종류</span>
                  <Select value={s.kind} onChange={(e) => patchSec(i, { kind: e.target.value as ArchiveSectionKind })} className="mt-1">{ARCHIVE_SECTION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</Select>
                </label>
                <label className="block"><span className={label}>순서</span><input className={field} type="number" min={1} max={10} value={s.order} onChange={(e) => patchSec(i, { order: e.target.value })} /></label>
                <label className="block"><span className={label}>상태</span>
                  <Select value={s.status} onChange={(e) => patchSec(i, { status: e.target.value as "pending" | "ready" })} className="mt-1"><option value="ready">ready (공개)</option><option value="pending">pending (준비 중)</option></Select>
                </label>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block"><span className={label}>제목 EN</span><input className={field} value={s.titleEn} onChange={(e) => patchSec(i, { titleEn: e.target.value })} /></label>
                <label className="block"><span className={label}>제목 KO</span><input className={field} value={s.titleKo} onChange={(e) => patchSec(i, { titleKo: e.target.value })} /></label>
              </div>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={s.optional} onChange={(e) => patchSec(i, { optional: e.target.checked })} className="h-4 w-4 accent-brand-blue" /><span className={label}>선택 섹션(optional) — pending이면 공개에서 통째로 제외</span></label>

              {s.status === "pending" ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block"><span className={label}>준비 안내 EN (공개 문구)</span><input className={field} value={s.noteEn} onChange={(e) => patchSec(i, { noteEn: e.target.value })} /></label>
                  <label className="block"><span className={label}>준비 안내 KO</span><input className={field} value={s.noteKo} onChange={(e) => patchSec(i, { noteKo: e.target.value })} /></label>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block"><span className={label}>소개 EN</span><Textarea rows={2} value={s.introEn} onChange={(e) => patchSec(i, { introEn: e.target.value })} className="mt-1" /></label>
                    <label className="block"><span className={label}>소개 KO</span><Textarea rows={2} value={s.introKo} onChange={(e) => patchSec(i, { introKo: e.target.value })} className="mt-1" /></label>
                  </div>
                  <MediaList title="갤러리 이미지" items={s.gallery} onChange={(g) => patchSec(i, { gallery: g })} />
                  <MediaList title="문서" items={s.documents} onChange={(d) => patchSec(i, { documents: d })} />
                  <QuoteList items={s.quotes} onChange={(q) => patchSec(i, { quotes: q })} />
                  <StatList items={s.stats} onChange={(st) => patchSec(i, { stats: st })} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "저장 중…" : mode === "create" ? "초안 생성" : "변경 저장"}</Button>
        <Button href="/admin/content/projects" variant="outline">목록으로</Button>
      </div>
    </div>
  );
}

const field2 = "w-full rounded-lg border border-field bg-white px-3 py-2 text-[15px] text-ink-strong outline-none focus:border-brand-blue";

function MediaList({ title, items, onChange }: { title: string; items: Media[]; onChange: (v: Media[]) => void }) {
  const patch = (i: number, p: Partial<Media>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-center justify-between"><span className="text-[15px] font-semibold text-ink-strong">{title}</span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, emptyMedia()])}>추가</Button></div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((m, i) => (
          <div key={i} className="grid gap-1.5 rounded-md bg-surface p-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input className={field2} value={m.src} placeholder="경로/URL" onChange={(e) => patch(i, { src: e.target.value })} />
            <input className={field2} value={m.altEn} placeholder="대체 EN" onChange={(e) => patch(i, { altEn: e.target.value })} />
            <input className={field2} value={m.altKo} placeholder="대체 KO" onChange={(e) => patch(i, { altKo: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteList({ items, onChange }: { items: Quote[]; onChange: (v: Quote[]) => void }) {
  const patch = (i: number, p: Partial<Quote>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-center justify-between"><span className="text-[15px] font-semibold text-ink-strong">인용</span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, { qEn: "", qKo: "", aEn: "", aKo: "" }])}>추가</Button></div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((q, i) => (
          <div key={i} className="grid gap-1.5 rounded-md bg-surface p-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto]">
            <input className={field2} value={q.qEn} placeholder="인용 EN" onChange={(e) => patch(i, { qEn: e.target.value })} />
            <input className={field2} value={q.qKo} placeholder="인용 KO" onChange={(e) => patch(i, { qKo: e.target.value })} />
            <input className={field2} value={q.aEn} placeholder="출처 EN" onChange={(e) => patch(i, { aEn: e.target.value })} />
            <input className={field2} value={q.aKo} placeholder="출처 KO" onChange={(e) => patch(i, { aKo: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatList({ items, onChange }: { items: Stat[]; onChange: (v: Stat[]) => void }) {
  const patch = (i: number, p: Partial<Stat>) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="flex items-center justify-between"><span className="text-[15px] font-semibold text-ink-strong">통계</span>
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, { lEn: "", lKo: "", vEn: "", vKo: "" }])}>추가</Button></div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((st, i) => (
          <div key={i} className="grid gap-1.5 rounded-md bg-surface p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <input className={field2} value={st.lEn} placeholder="라벨 EN" onChange={(e) => patch(i, { lEn: e.target.value })} />
            <input className={field2} value={st.lKo} placeholder="라벨 KO" onChange={(e) => patch(i, { lKo: e.target.value })} />
            <input className={field2} value={st.vEn} placeholder="값 EN" onChange={(e) => patch(i, { vEn: e.target.value })} />
            <input className={field2} value={st.vKo} placeholder="값 KO" onChange={(e) => patch(i, { vKo: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
