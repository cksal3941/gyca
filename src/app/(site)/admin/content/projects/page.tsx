"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Button, Message, Modal, StatusBadge, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import { listAdminProjects, deleteProject, type ArchiveAdminItem } from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";
import type { Page } from "@/contracts";

// Completed-project archive CMS list (LIVE, organizer). Draft/published/archived.
// Only published projects appear on the public archive/winners/exhibitions pages.

const STATUS_VIEW: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "초안", tone: "neutral" }, published: { label: "공개", tone: "success" }, archived: { label: "보관", tone: "neutral" },
};

export default function AdminProjectsPage() {
  const [state, setState] = useState<RequestState<Page<ArchiveAdminItem>>>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ArchiveAdminItem | null>(null);

  useEffect(() => {
    let alive = true;
    listAdminProjects().then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setBusy(true); setError(null); setNotice(null);
    const res = await deleteProject(item.id, { actionId: crypto.randomUUID(), expectedRevision: item.revision });
    setBusy(false); setPendingDelete(null);
    if (res.kind === "success") { setNotice("삭제했습니다."); reload(); }
    else setError(res.kind === "error" ? res.message : "삭제 실패");
  };

  return (
    <AdminShell eyebrow="Admin" title="아카이브(완료 프로젝트)" crumbs={[{ label: "관리자", href: "/admin" }, { label: "아카이브" }]}
      action={<Button href="/admin/content/projects/new">새 프로젝트</Button>}>
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">아카이브 관리는 라이브(운영자)에서 동작합니다.</Message>}
        {notice && <Message tone="success" className="mb-4">{notice}</Message>}
        {error && <Message tone="danger" className="mb-4" title="오류">{error}</Message>}
        {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {state.kind === "empty" && <p className="text-[16px] text-ink-strong">등록된 프로젝트가 없습니다.</p>}
        {state.kind === "error" && (
          <Message tone="danger" title="불러오지 못했습니다">
            {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED" ? "운영자 권한이 필요합니다." : "목록을 불러오지 못했습니다."}
            <div className="mt-3"><Button size="sm" onClick={() => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); }}>다시 시도</Button></div>
          </Message>
        )}
        {state.kind === "success" && (
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-[16px]">
              <thead><tr className="border-b border-line bg-surface text-ink-strong">
                <th className="px-5 py-3 font-semibold">프로그램</th><th className="px-5 py-3 font-semibold">슬러그</th>
                <th className="px-5 py-3 font-semibold">상태</th><th className="px-5 py-3" />
              </tr></thead>
              <tbody>
                {state.data.items.map((it) => (
                  <tr key={it.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4 font-semibold text-ink-strong">{it.content.hero.program.ko || it.content.hero.program.en}</td>
                    <td className="px-5 py-4 text-ink-strong">{it.slug}</td>
                    <td className="px-5 py-4"><StatusBadge tone={STATUS_VIEW[it.status]?.tone ?? "neutral"}>{STATUS_VIEW[it.status]?.label ?? it.status}</StatusBadge></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" href={`/admin/content/projects/${it.id}`}>{it.status === "archived" ? "보기" : "편집"}</Button>
                        {(it.status === "draft" || it.status === "archived") && <Button size="sm" variant="outline" className="border-danger text-danger hover:bg-danger/5" onClick={() => setPendingDelete(it)} disabled={busy}>삭제</Button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="프로젝트 삭제"
        description="이 작업은 되돌릴 수 없습니다. 보관(archive)은 목록에 남지만, 삭제는 완전히 제거합니다."
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={busy}>취소</Button>
            <Button className="bg-danger text-white hover:opacity-90" onClick={confirmDelete} disabled={busy}>
              {busy ? "삭제 중…" : "삭제"}
            </Button>
          </>
        }
      >
        {pendingDelete && (
          <p className="text-[16px] text-ink-strong">
            <span className="font-semibold">{pendingDelete.content.hero.program.ko || pendingDelete.content.hero.program.en}</span>
            {" "}({pendingDelete.slug}) 항목을 삭제합니다.
          </p>
        )}
      </Modal>
    </AdminShell>
  );
}
