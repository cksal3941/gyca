"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Select, Textarea, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  listAdminEditorial,
  createEditorial,
  transitionEditorial,
  type EditorialAdminItem,
} from "@/lib/api/ops";
import { EDITORIAL_CATEGORIES, EditorialBodySchema } from "@/contracts/editorial-content";
import type { RequestState } from "@/lib/api";
import type { Page } from "@/contracts";

// Editorial content CMS (LIVE, organizer). Create drafts, publish/archive.
// Body is plain text (no raw HTML). Only published items appear on the public site.

const CAT_LABEL: Record<string, string> = { notice: "공지", schedule: "일정", faq: "FAQ", news: "뉴스", press: "보도" };
const STATUS_VIEW: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "초안", tone: "neutral" }, published: { label: "공개", tone: "success" }, archived: { label: "보관", tone: "neutral" },
};
const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";
const label = "text-[16px] font-semibold text-ink-strong";

export default function AdminEditorialPage() {
  const [state, setState] = useState<RequestState<Page<EditorialAdminItem>>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [category, setCategory] = useState<string>("notice");
  const [slug, setSlug] = useState("");
  const [titleEn, setTitleEn] = useState(""); const [titleKo, setTitleKo] = useState("");
  const [summaryEn, setSummaryEn] = useState(""); const [summaryKo, setSummaryKo] = useState("");
  const [bodyEn, setBodyEn] = useState(""); const [bodyKo, setBodyKo] = useState("");
  const [displayDate, setDisplayDate] = useState("");

  useEffect(() => {
    let alive = true;
    listAdminEditorial({ limit: 50 }).then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); };

  const create = async () => {
    setBusy(true); setError(null); setNotice(null);
    const parsed = EditorialBodySchema.safeParse({
      title: { en: titleEn.trim(), ko: titleKo.trim() },
      summary: { en: summaryEn.trim(), ko: summaryKo.trim() },
      body: { en: bodyEn.trim(), ko: bodyKo.trim() },
      displayDate, coverImage: null,
    });
    if (!parsed.success) {
      setBusy(false);
      setError(`입력값 확인: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
      return;
    }
    const res = await createEditorial({ actionId: crypto.randomUUID(), slug: slug.trim(), category, content: parsed.data });
    setBusy(false);
    if (res.kind === "success") {
      setNotice("초안을 만들었습니다. 목록에서 공개할 수 있습니다.");
      setSlug(""); setTitleEn(""); setTitleKo(""); setSummaryEn(""); setSummaryKo(""); setBodyEn(""); setBodyKo(""); setDisplayDate("");
      reload();
    } else {
      setError(res.kind === "error" ? (res.code === "VALIDATION_FAILED" ? `입력값 확인: ${res.message}` : res.message) : "생성 실패");
    }
  };

  const act = async (item: EditorialAdminItem, action: "publish" | "archive") => {
    setBusy(true); setError(null); setNotice(null);
    const res = await transitionEditorial(item.id, action, { actionId: crypto.randomUUID(), expectedRevision: item.revision });
    setBusy(false);
    if (res.kind === "success") { setNotice(action === "publish" ? "공개했습니다." : "보관 처리했습니다."); reload(); }
    else setError(res.kind === "error" ? res.message : "처리 실패");
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="콘텐츠 관리 (공지·뉴스)"
        crumbs={[{ label: "관리자", href: "/admin" }, { label: "콘텐츠 관리" }]}
      />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">콘텐츠 관리는 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}

        {/* create */}
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">새 콘텐츠 (초안)</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_2fr_1fr]">
            <label className="block"><span className={label}>분류</span>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1">
                {EDITORIAL_CATEGORIES.map((c) => <option key={c} value={c}>{CAT_LABEL[c] ?? c}</option>)}
              </Select>
            </label>
            <label className="block"><span className={label}>슬러그</span>
              <input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="2027-schedule" />
            </label>
            <label className="block"><span className={label}>표시 날짜</span>
              <input className={field} type="date" value={displayDate} onChange={(e) => setDisplayDate(e.target.value)} />
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={label}>제목 EN</span><input className={field} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} /></label>
            <label className="block"><span className={label}>제목 KO</span><input className={field} value={titleKo} onChange={(e) => setTitleKo(e.target.value)} /></label>
            <label className="block"><span className={label}>요약 EN</span><input className={field} value={summaryEn} onChange={(e) => setSummaryEn(e.target.value)} /></label>
            <label className="block"><span className={label}>요약 KO</span><input className={field} value={summaryKo} onChange={(e) => setSummaryKo(e.target.value)} /></label>
            <label className="block"><span className={label}>본문 EN</span><Textarea rows={4} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} className="mt-1" /></label>
            <label className="block"><span className={label}>본문 KO</span><Textarea rows={4} value={bodyKo} onChange={(e) => setBodyKo(e.target.value)} className="mt-1" /></label>
          </div>
          <p className="mt-3 text-[15px] text-ink-strong/70">본문은 일반 텍스트입니다(HTML 미지원). 초안 생성 후 목록에서 공개하세요.</p>
          <Button className="mt-4" onClick={create} disabled={busy}>{busy ? "처리 중…" : "초안 생성"}</Button>
        </div>

        {/* list */}
        <div className="mt-8">
          {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
          {state.kind === "empty" && <p className="text-[16px] text-ink-strong">아직 콘텐츠가 없습니다.</p>}
          {state.kind === "error" && (
            <Message tone="danger" title="불러오지 못했습니다">
              {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED" ? "운영자 권한이 필요합니다." : "목록을 불러오지 못했습니다."}
            </Message>
          )}
          {state.kind === "success" && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[720px] text-left text-[16px]">
                <thead>
                  <tr className="border-b border-line bg-surface text-ink-strong">
                    <th className="px-5 py-3 font-semibold">분류</th>
                    <th className="px-5 py-3 font-semibold">제목</th>
                    <th className="px-5 py-3 font-semibold">슬러그</th>
                    <th className="px-5 py-3 font-semibold">상태</th>
                    <th className="px-5 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-4 text-ink-strong">{CAT_LABEL[it.category] ?? it.category}</td>
                      <td className="px-5 py-4 font-semibold text-ink-strong">{it.content.title.ko || it.content.title.en}</td>
                      <td className="px-5 py-4 text-ink-strong">{it.slug}</td>
                      <td className="px-5 py-4"><StatusBadge tone={STATUS_VIEW[it.status]?.tone ?? "neutral"}>{STATUS_VIEW[it.status]?.label ?? it.status}</StatusBadge></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {it.allowedActions.includes("publish") && (
                            <Button size="sm" onClick={() => act(it, "publish")} disabled={busy}>공개</Button>
                          )}
                          {it.allowedActions.includes("archive") && (
                            <Button size="sm" variant="outline" onClick={() => act(it, "archive")} disabled={busy}>보관</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
