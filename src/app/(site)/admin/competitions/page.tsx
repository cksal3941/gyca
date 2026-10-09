"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { Button, Message, StatusBadge } from "@/components/ds";
import { listAdminCompetitions, type AdminCompetitionRef } from "@/lib/api/ops";
import { isLive } from "@/lib/api/mode";
import type { RequestState } from "@/lib/api";

// Competition management (LIVE, organizer). Lists competitions and links to
// create/edit. Access is enforced server-side (403 for non-organizers).

export default function AdminCompetitionsPage() {
  const [state, setState] = useState<RequestState<AdminCompetitionRef[]>>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    listAdminCompetitions().then((r) => {
      if (alive) setState(r);
    });
    return () => { alive = false; };
  }, []);

  return (
    <AdminShell
      eyebrow="Admin"
      title="공모 관리"
      description="공모를 등록·편집하고 접수를 엽니다."
      crumbs={[{ label: "관리자", href: "/admin" }, { label: "공모 관리" }]}
      action={<Button href="/admin/competitions/new">새 공모 등록</Button>}
    >

      <section className="mx-auto max-w-page px-6 py-12">
        {!isLive && (
          <Message tone="info" className="mb-6" title="미리보기">
            공모 관리(등록·오픈)는 라이브(운영자 세션)에서 동작합니다.
          </Message>
        )}

        {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {state.kind === "empty" && (
          <div className="rounded-2xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
            <p className="text-[16px] text-ink-strong">등록된 공모가 없습니다. “새 공모 등록”으로 시작하세요.</p>
          </div>
        )}
        {state.kind === "error" && (
          <Message tone="danger" title="접근할 수 없습니다">
            {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED"
              ? "운영자 계정으로 로그인했는지 확인하세요."
              : "목록을 불러오지 못했습니다."}
          </Message>
        )}
        {state.kind === "success" && (
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[520px] text-left text-[16px]">
              <thead>
                <tr className="border-b border-line bg-surface text-ink-strong">
                  <th className="px-5 py-3 font-semibold">슬러그</th>
                  <th className="px-5 py-3 font-semibold">공개</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {state.data.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4 font-semibold text-ink-strong">{c.slug}</td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={c.published ? "success" : "neutral"}>{c.published ? "공개" : "비공개"}</StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/admin/competitions/${c.id}`} className="text-[16px] font-semibold text-brand-blue hover:underline">
                        편집·오픈
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
