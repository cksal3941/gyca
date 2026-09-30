"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Message, StatusBadge, type Tone } from "@/components/ds";
import { getLaunchReadiness, openApplications, pauseApplications, resumeApplications } from "@/lib/api/ops";

// Launch control (LIVE, organizer). Shows the server launch-readiness checks and
// opens/pauses/resumes applications. Opening is enforced server-side — a 503 means
// readiness is not yet met (missing policies / unverified storage-retention-PG).
// We never fake readiness; the operator must satisfy the real gates first.

const CHECK_LABEL: Record<string, string> = {
  public_content: "공개 콘텐츠", published: "공개 여부", schedule: "일정", form: "폼(부문·필드·업로드)",
  consents: "동의문", guardian_policy: "보호자 정책", guardian_verification: "보호자 확인",
  payment_policy: "결제 정책", payment_routes: "결제 경로", checkout: "결제창",
  storage: "저장소", retention: "보관 정책", live_payment_verification: "실결제 검증",
};
const STATUS_VIEW: Record<string, { label: string; tone: Tone }> = {
  configured: { label: "충족", tone: "success" },
  missing: { label: "미설정", tone: "danger" },
  unverified: { label: "미검증", tone: "warning" },
};

export default function LaunchControl({
  competitionId,
  draftEnabled,
}: {
  competitionId: string;
  draftEnabled: boolean;
}) {
  const router = useRouter();
  const [checks, setChecks] = useState<{ code: string; status: string }[] | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getLaunchReadiness(competitionId).then((r) => {
      if (!alive) return;
      if (r.kind === "success") {
        setChecks(r.data.checks.map((c) => ({ code: c.code, status: c.status })));
        setRevision(r.data.revision);
      } else {
        setErr(r.kind === "error" ? r.message : "준비 상태를 불러오지 못했습니다.");
      }
    });
    return () => { alive = false; };
  }, [competitionId, reloadKey]);

  const allConfigured = checks !== null && checks.every((c) => c.status === "configured");

  const act = async (kind: "open" | "pause" | "resume") => {
    if (revision === null) return;
    if (!reason.trim()) {
      setErr("사유를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setErr(null);
    setNotice(null);
    const res =
      kind === "open"
        ? await openApplications(competitionId, { actionId: crypto.randomUUID(), expectedRevision: revision, reason: reason.trim() })
        : kind === "pause"
          ? await pauseApplications(competitionId, { revision, reason: reason.trim() })
          : await resumeApplications(competitionId, { revision, reason: reason.trim() });
    setBusy(false);
    if (res.kind === "success") {
      setNotice(kind === "open" ? "접수를 열었습니다." : kind === "pause" ? "접수를 일시 중단했습니다." : "접수를 재개했습니다.");
      setReason("");
      setReloadKey((k) => k + 1);
      router.refresh();
    } else if (res.kind === "error") {
      setErr(
        res.code === "POLICY_NOT_CONFIGURED"
          ? "준비 조건이 아직 충족되지 않아 열 수 없습니다. 아래 미설정·미검증 항목을 먼저 완료하세요."
          : res.code === "REVISION_CONFLICT"
            ? "다른 곳에서 먼저 변경되었습니다. 새로고침 후 다시 시도해 주세요."
            : res.message,
      );
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">오픈 제어</h3>
      <div className="mt-2 flex items-center gap-2">
        <StatusBadge tone={draftEnabled ? "success" : "neutral"}>{draftEnabled ? "접수 열림" : "접수 닫힘"}</StatusBadge>
      </div>

      <h4 className="mt-5 text-[16px] font-semibold text-ink-strong">준비 상태 (launch-readiness)</h4>
      {checks === null ? (
        <p className="mt-2 text-[16px] text-ink-strong/70">불러오는 중…</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {checks.map((c) => (
            <StatusBadge key={c.code} tone={STATUS_VIEW[c.status]?.tone ?? "neutral"}>
              {CHECK_LABEL[c.code] ?? c.code}: {STATUS_VIEW[c.status]?.label ?? c.status}
            </StatusBadge>
          ))}
        </ul>
      )}
      {!allConfigured && checks !== null && (
        <p className="mt-2 text-[15px] text-ink-strong/70">미설정·미검증 항목이 남아 있으면 접수를 열 수 없습니다(외부 검증이 필요한 항목은 임의로 충족 처리하지 않습니다).</p>
      )}

      <label className="mt-5 block">
        <span className="text-[16px] font-semibold text-ink-strong">사유 (감사 기록)</span>
        <input
          className="mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 1차 접수 오픈"
        />
      </label>

      {notice && <Message tone="success" className="mt-4">{notice}</Message>}
      {err && <Message tone="danger" className="mt-4" title="처리 실패">{err}</Message>}

      <div className="mt-4 flex flex-wrap gap-3">
        {!draftEnabled ? (
          <Button onClick={() => act("open")} disabled={busy || revision === null}>접수 열기</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => act("pause")} disabled={busy || revision === null}>접수 일시 중단</Button>
            <Button variant="outline" onClick={() => act("resume")} disabled={busy || revision === null}>접수 재개</Button>
          </>
        )}
      </div>
    </div>
  );
}
