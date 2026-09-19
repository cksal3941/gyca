"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, type Tone } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import { listAdminProjects, type ArchiveAdminItem } from "@/lib/api/ops";
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

  useEffect(() => {
    let alive = true;
    listAdminProjects().then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <>
      <PageHeader eyebrow="Admin" title="아카이브(완료 프로젝트)" crumbs={[{ label: "관리자", href: "/admin" }, { label: "아카이브" }]}
        action={<Button href="/admin/content/projects/new">새 프로젝트</Button>} />
      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && <Message tone="info" className="mb-6" title="미리보기">아카이브 관리는 라이브(운영자)에서 동작합니다.</Message>}
        {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {state.kind === "empty" && <p className="text-[16px] text-ink-strong">등록된 프로젝트가 없습니다.</p>}
        {state.kind === "error" && (
          <Message tone="danger" title="불러오지 못했습니다">
            {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED" ? "운영자 권한이 필요합니다." : "목록을 불러오지 못했습니다."}
            <div className="mt-3"><Button size="sm" onClick={() => { setState({ kind: "loading" }); setReloadKey((k) => k + 1); }}>다시 시도</Button></div>
          </Message>
        )}
        {state.kind === "success" && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
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
                      <Button size="sm" variant="outline" href={`/admin/content/projects/${it.id}`}>{it.status === "archived" ? "보기" : "편집"}</Button>
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
