"use client";

import { useEffect, useState } from "react";
import { Button, Message } from "@/components/ds";
import { getAdminProject, publishProject, archiveProject, type ArchiveAdminItem } from "@/lib/api/ops";
import ArchiveForm from "./ArchiveForm";

// Loads one archive project (LIVE, organizer) client-side, then renders the edit
// form plus publish/archive controls. Publish records internal evidence; archive
// is terminal (no restore) and is gated behind an explicit confirm.

type Phase = "loading" | "notfound" | "error" | "ready";
const field = "w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";

export default function ArchiveEditor({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [proj, setProj] = useState<ArchiveAdminItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // publish evidence
  const [sourceRef, setSourceRef] = useState("");
  const [rightsRef, setRightsRef] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    let alive = true;
    getAdminProject(id).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { setProj(r.data); setPhase("ready"); }
      else setPhase(r.kind === "error" && r.code !== "NOT_FOUND" && r.code !== "FORBIDDEN" && r.code !== "UNAUTHENTICATED" ? "error" : "notfound");
    });
    return () => { alive = false; };
  }, [id, reloadKey]);

  const reload = () => { setPhase("loading"); setReloadKey((k) => k + 1); };

  const publish = async () => {
    if (!proj) return;
    if (sourceRef.trim() === "" || rightsRef.trim() === "") { setError("발행에는 자료 출처와 이용 권한 근거(내부 기록 참조)가 필요합니다."); return; }
    setBusy(true); setError(null); setNotice(null);
    const res = await publishProject(proj.id, {
      actionId: crypto.randomUUID(), expectedRevision: proj.revision,
      evidence: { sourceReference: sourceRef.trim(), rightsReference: rightsRef.trim(), confirmedForPublication: true },
    });
    setBusy(false);
    if (res.kind === "success") { setNotice("발행했습니다. 공개 아카이브에 노출됩니다."); setSourceRef(""); setRightsRef(""); setProj(res.data); }
    else if (res.kind === "error" && res.code === "REVISION_CONFLICT") { setError("최신 상태가 아닙니다. 다시 불러옵니다."); reload(); }
    else setError(res.kind === "error" ? res.message : "발행 실패");
  };

  const archive = async () => {
    if (!proj) return;
    setBusy(true); setError(null); setNotice(null);
    const res = await archiveProject(proj.id, { actionId: crypto.randomUUID(), expectedRevision: proj.revision });
    setBusy(false); setConfirmArchive(false);
    if (res.kind === "success") { setNotice("보관 처리했습니다. 공개에서 내려갔으며 복구할 수 없습니다."); setProj(res.data); }
    else if (res.kind === "error" && res.code === "REVISION_CONFLICT") { setError("최신 상태가 아닙니다. 다시 불러옵니다."); reload(); }
    else setError(res.kind === "error" ? res.message : "보관 실패");
  };

  if (phase === "loading") return <div className="h-48 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" />;
  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <div>
        <Message tone={isError ? "danger" : "info"} title={isError ? "불러오지 못했습니다" : "프로젝트를 찾을 수 없습니다"}>
          {isError ? "문제가 발생했습니다. 다시 시도해 주세요." : "해당 프로젝트가 없거나 접근 권한이 없습니다."}
        </Message>
        <div className="mt-6 flex gap-3">
          {isError && <Button onClick={reload}>다시 시도</Button>}
          <Button href="/admin/content/projects" variant={isError ? "outline" : "primary"}>목록으로</Button>
        </div>
      </div>
    );
  }

  const p = proj as ArchiveAdminItem;
  const isArchived = p.status === "archived";
  return (
    <div className="flex flex-col gap-8">
      {notice && <Message tone="success">{notice}</Message>}
      {error && <Message tone="danger" title="오류">{error}</Message>}

      {/* status + lifecycle controls */}
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[16px] font-semibold text-ink-strong">상태: {p.status === "draft" ? "초안" : p.status === "published" ? "공개" : "보관"}</span>
          {p.publishedAt && <span className="text-[15px] text-ink-strong/70">최근 발행 있음</span>}
        </div>
        {isArchived ? (
          <p className="mt-3 text-[16px] text-ink-strong">보관된 프로젝트는 복구·수정할 수 없습니다.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {p.allowedActions.includes("publish") && (
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-[15px] font-semibold text-ink-strong">발행 (공개 근거 필요)</p>
                <p className="mt-1 text-[15px] text-ink-strong/70">ready 섹션이 하나 이상 있어야 합니다. 근거는 실제 내부 검토 기록의 식별자를 입력하세요(연락처·계약 원문·신분증 금지).</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input className={field} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="자료 출처 참조 (예: internal-record:materials-reviewed)" />
                  <input className={field} value={rightsRef} onChange={(e) => setRightsRef(e.target.value)} placeholder="이용 권한 참조 (예: internal-record:permissions-reviewed)" />
                </div>
                <Button className="mt-3" onClick={publish} disabled={busy}>{busy ? "처리 중…" : "발행"}</Button>
              </div>
            )}
            {p.allowedActions.includes("archive") && (
              <div className="rounded-xl border border-danger/40 bg-danger/5 p-4">
                <p className="text-[15px] font-semibold text-ink-strong">보관 (되돌릴 수 없음)</p>
                <p className="mt-1 text-[15px] text-ink-strong/70">보관하면 공개에서 즉시 사라지고 편집이 종료됩니다. 복구·삭제 기능은 없습니다.</p>
                {confirmArchive ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={archive} disabled={busy}>보관 확정</Button>
                    <Button variant="ghost" onClick={() => setConfirmArchive(false)} disabled={busy}>취소</Button>
                  </div>
                ) : (
                  <Button className="mt-3" variant="outline" onClick={() => { setConfirmArchive(true); setError(null); setNotice(null); }} disabled={busy}>보관…</Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!isArchived && <ArchiveForm mode="edit" initial={p} />}
    </div>
  );
}
