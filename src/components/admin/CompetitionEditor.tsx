"use client";

import { useEffect, useState } from "react";
import { Button, Message } from "@/components/ds";
import { getAdminCompetition, type AdminCompetition } from "@/lib/api/ops";
import CompetitionForm from "./CompetitionForm";
import LaunchControl from "./LaunchControl";
import PresentationEditor from "./PresentationEditor";

// Loads one competition (LIVE, organizer) client-side, then renders the edit form
// and launch control. A server component cannot forward the session cookie.

type Phase = "loading" | "notfound" | "error" | "ready";

export default function CompetitionEditor({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [comp, setComp] = useState<AdminCompetition | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getAdminCompetition(id);
      if (!alive) return;
      if (r.kind !== "success") {
        setPhase(r.kind === "error" && r.code !== "NOT_FOUND" && r.code !== "FORBIDDEN" && r.code !== "UNAUTHENTICATED" ? "error" : "notfound");
        return;
      }
      setComp(r.data);
      setPhase("ready");
    })();
    return () => { alive = false; };
  }, [id, reloadKey]);

  if (phase === "loading") {
    return <div className="h-48 animate-pulse rounded-2xl border border-line bg-surface" aria-busy="true" />;
  }
  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <div>
        <Message tone={isError ? "danger" : "info"} title={isError ? "불러오지 못했습니다" : "공모를 찾을 수 없습니다"}>
          {isError ? "문제가 발생했습니다. 다시 시도해 주세요." : "해당 공모가 없거나 접근 권한이 없습니다."}
        </Message>
        <div className="mt-6 flex gap-3">
          {isError && <Button onClick={() => { setPhase("loading"); setReloadKey((k) => k + 1); }}>다시 시도</Button>}
          <Button href="/admin/competitions" variant={isError ? "outline" : "primary"}>목록으로</Button>
        </div>
      </div>
    );
  }

  const c = comp as AdminCompetition;
  return (
    <div className="flex flex-col gap-8">
      <LaunchControl competitionId={c.id} draftEnabled={c.draftEnabled} />
      <CompetitionForm mode="edit" initial={c} />
      <PresentationEditor competitionId={c.id} />
    </div>
  );
}
