"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Select, Textarea, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  listAdminPartners, createPartner, partnerRelationship, transitionPartner,
  type PartnerAdminItem,
} from "@/lib/api/ops";
import { PARTNER_TYPES, PartnerBodySchema } from "@/contracts/partner-content";
import type { RequestState } from "@/lib/api";
import type { Page } from "@/contracts";

// Partner content CMS (LIVE, organizer). Create draft → confirm relationship
// (evidence + reason) → publish. A partner cannot be published before the
// relationship is confirmed (server-enforced allowedActions).

const TYPE_LABEL: Record<string, string> = {
  organizer: "주최", international_program_partner: "국제 프로그램", venue: "전시장",
  cultural_partner: "문화 파트너", publishing_partner: "출판 파트너", educational_partner: "교육 파트너",
};
const STATUS_VIEW: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "초안", tone: "neutral" }, published: { label: "공개", tone: "success" }, archived: { label: "보관", tone: "neutral" },
};
const REL_VIEW: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "관계 미확인", tone: "warning" }, confirmed: { label: "확인됨", tone: "success" }, revoked: { label: "철회", tone: "danger" },
};
const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";
const label = "text-[16px] font-semibold text-ink-strong";

export default function AdminPartnersPage() {
  const [state, setState] = useState<RequestState<Page<PartnerAdminItem>>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [partnerType, setPartnerType] = useState<string>("venue");
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState(""); const [nameKo, setNameKo] = useState("");
  const [descEn, setDescEn] = useState(""); const [descKo, setDescKo] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [websiteUrl, setWebsiteUrl] = useState("");
  // shared relationship evidence/reason for confirm/revoke
  const [evidence, setEvidence] = useState(""); const [reason, setReason] = useState("");

  useEffect(() => {
    let alive = true;
    listAdminPartners().then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); };

  const create = async () => {
    setBusy(true); setError(null); setNotice(null);
    const body = PartnerBodySchema.safeParse({
      name: { en: nameEn.trim(), ko: nameKo.trim() },
      description: { en: descEn.trim(), ko: descKo.trim() },
      displayOrder: Number(displayOrder) || 0,
      websiteUrl: websiteUrl.trim() === "" ? null : websiteUrl.trim(),
      logo: null,
    });
    if (!body.success) {
      setBusy(false);
      setError(`입력값 확인: ${body.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
      return;
    }
    const res = await createPartner({ actionId: crypto.randomUUID(), slug: slug.trim(), partnerType, content: body.data });
    setBusy(false);
    if (res.kind === "success") {
      setNotice("파트너 초안을 만들었습니다. 관계 확인 후 공개하세요.");
      setSlug(""); setNameEn(""); setNameKo(""); setDescEn(""); setDescKo(""); setDisplayOrder("0"); setWebsiteUrl("");
      reload();
    } else setError(res.kind === "error" ? res.message : "생성 실패");
  };

  const rel = async (it: PartnerAdminItem, action: "confirm" | "revoke") => {
    if (!evidence.trim() || !reason.trim()) { setError("관계 확인/철회에는 증거 참조와 사유가 필요합니다."); return; }
    setBusy(true); setError(null); setNotice(null);
    const res = await partnerRelationship(it.id, action, { actionId: crypto.randomUUID(), expectedRevision: it.revision, evidenceReference: evidence.trim(), reason: reason.trim() });
    setBusy(false);
    if (res.kind === "success") { setNotice(action === "confirm" ? "관계를 확인했습니다." : "관계를 철회했습니다."); setEvidence(""); setReason(""); reload(); }
    else setError(res.kind === "error" ? res.message : "처리 실패");
  };

  const trans = async (it: PartnerAdminItem, action: "publish" | "archive") => {
    setBusy(true); setError(null); setNotice(null);
    const res = await transitionPartner(it.id, action, { actionId: crypto.randomUUID(), expectedRevision: it.revision });
    setBusy(false);
    if (res.kind === "success") { setNotice(action === "publish" ? "공개했습니다." : "보관했습니다."); reload(); }
    else setError(res.kind === "error" ? res.message : "처리 실패");
  };

  return (
    <>
      <PageHeader eyebrow="Admin" title="협력기관 관리" crumbs={[{ label: "관리자", href: "/admin" }, { label: "협력기관" }]} />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">협력기관 관리는 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}

        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">새 협력기관 (초안)</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_1fr]">
            <label className="block"><span className={label}>유형</span>
              <Select value={partnerType} onChange={(e) => setPartnerType(e.target.value)} className="mt-1">
                {PARTNER_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] ?? t}</option>)}
              </Select>
            </label>
            <label className="block"><span className={label}>슬러그</span><input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="klimt-villa" /></label>
            <label className="block"><span className={label}>표시 순서</span><input className={field} type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} /></label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className={label}>이름 EN</span><input className={field} value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></label>
            <label className="block"><span className={label}>이름 KO</span><input className={field} value={nameKo} onChange={(e) => setNameKo(e.target.value)} /></label>
            <label className="block"><span className={label}>소개 EN</span><Textarea rows={3} value={descEn} onChange={(e) => setDescEn(e.target.value)} className="mt-1" /></label>
            <label className="block"><span className={label}>소개 KO</span><Textarea rows={3} value={descKo} onChange={(e) => setDescKo(e.target.value)} className="mt-1" /></label>
          </div>
          <label className="mt-4 block"><span className={label}>웹사이트 (https, 선택)</span><input className={field} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" /></label>
          <Button className="mt-4" onClick={create} disabled={busy}>초안 생성</Button>
        </div>

        {/* relationship evidence (for confirm/revoke) */}
        <div className="mt-6 rounded-2xl border border-dashed border-field bg-canvas p-4">
          <p className="text-[15px] font-semibold text-ink-strong">관계 확인/철회 입력 (아래 목록 버튼에 사용)</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input className={field} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="증거 참조 (예: 계약서 링크·문서 ID)" />
            <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="사유" />
          </div>
        </div>

        <div className="mt-8">
          {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
          {state.kind === "empty" && <p className="text-[16px] text-ink-strong">등록된 협력기관이 없습니다.</p>}
          {state.kind === "error" && <Message tone="danger" title="불러오지 못했습니다">{state.code === "FORBIDDEN" ? "운영자 권한이 필요합니다." : "목록을 불러오지 못했습니다."}</Message>}
          {state.kind === "success" && (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[820px] text-left text-[16px]">
                <thead><tr className="border-b border-line bg-surface text-ink-strong">
                  <th className="px-5 py-3 font-semibold">유형</th><th className="px-5 py-3 font-semibold">이름</th>
                  <th className="px-5 py-3 font-semibold">관계</th><th className="px-5 py-3 font-semibold">상태</th><th className="px-5 py-3" />
                </tr></thead>
                <tbody>
                  {state.data.items.map((it) => (
                    <tr key={it.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-4 text-ink-strong">{TYPE_LABEL[it.partnerType] ?? it.partnerType}</td>
                      <td className="px-5 py-4 font-semibold text-ink-strong">{it.content.name.ko || it.content.name.en}</td>
                      <td className="px-5 py-4"><StatusBadge tone={REL_VIEW[it.relationshipStatus]?.tone ?? "neutral"}>{REL_VIEW[it.relationshipStatus]?.label ?? it.relationshipStatus}</StatusBadge></td>
                      <td className="px-5 py-4"><StatusBadge tone={STATUS_VIEW[it.status]?.tone ?? "neutral"}>{STATUS_VIEW[it.status]?.label ?? it.status}</StatusBadge></td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {it.allowedActions.includes("confirm_relationship") && <Button size="sm" onClick={() => rel(it, "confirm")} disabled={busy}>관계 확인</Button>}
                          {it.allowedActions.includes("revoke_relationship") && <Button size="sm" variant="outline" onClick={() => rel(it, "revoke")} disabled={busy}>관계 철회</Button>}
                          {it.allowedActions.includes("publish") && <Button size="sm" onClick={() => trans(it, "publish")} disabled={busy}>공개</Button>}
                          {it.allowedActions.includes("archive") && <Button size="sm" variant="outline" onClick={() => trans(it, "archive")} disabled={busy}>보관</Button>}
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
