"use client";

import { useEffect, useState } from "react";
import { Button, Message, StatusBadge, Textarea, Select } from "@/components/ds";
import { isLive } from "@/lib/api/mode";
import {
  getReviewContext,
  saveReviewDraft,
  submitReview,
  type ReviewContext,
  type ReviewDraft,
  type SaveScenario,
  type SubmitScenario,
} from "@/lib/api/ops";

// Judge review editor (BLIND). CLIENT component: it fetches the review context with
// the Better Auth session (a server component cannot forward the cookie). Rubric
// criteria + max scores come from the settings the server returns — never fixed
// here. Draft save reports "saved" only on a successful response; a concurrent-edit
// conflict is surfaced, not silently overwritten. Post-submit editability follows
// the server flag. The blinded PDF may not be ready yet (BLINDED_FILE_NOT_READY).

type SaveStatus = "idle" | "saving" | "saved" | "error";
type Phase = "loading" | "notfound" | "error" | "ready";

export default function ReviewEditor({ id }: { id: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [revision, setRevision] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Dev-only outcome simulation (mock mode only).
  const [saveSim, setSaveSim] = useState<SaveScenario>("ok");
  const [submitSim, setSubmitSim] = useState<SubmitScenario>("ok");

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getReviewContext(id);
      if (!alive) return;
      if (r.kind !== "success") {
        setPhase(r.kind === "error" && r.code !== "NOT_FOUND" && r.code !== "FORBIDDEN" ? "error" : "notfound");
        return;
      }
      const d = r.data;
      setCtx(d);
      setScores({ ...d.draft.scores });
      setComment(d.draft.comment);
      setRevision(d.revision);
      setSubmitted(d.submitted);
      setPhase("ready");
    })();
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  // Re-fetch the latest server state (used after a conflict). Loading is re-armed
  // in the handler, never synchronously in the effect.
  const reload = () => {
    setConflict(false);
    setSubmitErr(null);
    setSaveErr(null);
    setSaveStatus("idle");
    setPhase("loading");
    setReloadKey((k) => k + 1);
  };

  if (phase === "loading") {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_400px]" aria-busy="true">
        <div className="h-[420px] animate-pulse rounded-2xl border border-line bg-surface" />
        <div className="h-[420px] animate-pulse rounded-2xl border border-line bg-surface" />
        <span className="sr-only" role="status">불러오는 중</span>
      </div>
    );
  }

  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <div className="max-w-[46rem]">
        <Message
          tone={isError ? "danger" : "info"}
          title={isError ? "불러오지 못했습니다" : "배정을 찾을 수 없습니다"}
        >
          {isError
            ? "문제가 발생했습니다. 다시 시도해 주세요."
            : "해당 배정이 없거나 접근 권한이 없습니다. 배정되지 않은 작품은 조회할 수 없습니다."}
        </Message>
        <div className="mt-6 flex flex-wrap gap-3">
          {isError && <Button onClick={reload}>다시 시도</Button>}
          <Button href="/judge" variant={isError ? "outline" : "primary"}>
            배정 목록으로
          </Button>
        </div>
      </div>
    );
  }

  const { assignment, rubric, editableAfterSubmit, pdf, blockingReasons } = ctx as ReviewContext;
  const blindNotReady = pdf === null || blockingReasons.includes("BLINDED_FILE_NOT_READY");
  const locked = submitted && !editableAfterSubmit;
  const totalMax = rubric.reduce((s, c) => s + c.maxScore, 0);
  const total = rubric.reduce((s, c) => s + (scores[c.id] ?? 0), 0);

  const setScore = (cid: string, max: number, raw: string) => {
    const n = Math.max(0, Math.min(max, Math.round(Number(raw) || 0)));
    setScores((s) => ({ ...s, [cid]: n }));
    setSaveStatus("idle");
  };

  const draft: ReviewDraft = { scores, comment };

  const onSave = async () => {
    setSaveStatus("saving");
    setSaveErr(null);
    const r = await saveReviewDraft(id, draft, { expectedRevision: revision, scenario: saveSim, delayMs: 600 });
    if (r.kind === "success") {
      setSaveStatus("saved");
      setRevision(r.data.revision);
    } else {
      // A failed save must NOT show "saved".
      setSaveStatus("error");
      setSaveErr(r.kind === "error" ? r.message : "저장 실패");
      if (r.kind === "error" && r.code === "REVISION_CONFLICT") setConflict(true);
    }
  };

  const onSubmit = async () => {
    setBusy(true);
    setSubmitErr(null);
    setConflict(false);
    const r = await submitReview(id, draft, { expectedRevision: revision, scenario: submitSim, delayMs: 700 });
    setBusy(false);
    if (r.kind === "success") {
      setSubmitted(true);
      setRevision(r.data.revision);
    } else if (r.kind === "error") {
      if (r.code === "REVISION_CONFLICT") setConflict(true);
      setSubmitErr(r.message);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      {/* LEFT — blind PDF viewer */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="neutral">{assignment.code}</StatusBadge>
          <StatusBadge tone="neutral">
            {assignment.category} · {assignment.ageGroup}
          </StatusBadge>
          <StatusBadge tone="info">블라인드 심사</StatusBadge>
        </div>
        {blindNotReady ? (
          <div className="mt-4 flex h-[420px] w-full flex-col items-center justify-center rounded-2xl border border-line bg-canvas text-center">
            <p className="text-[16px] font-semibold text-ink-strong">블라인드 파일 준비 중</p>
            <p className="mt-1 text-[16px] text-ink-strong">
              식별정보를 제거한 심사용 파일이 아직 준비되지 않았습니다. 준비되면 여기에서 열람할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex h-[420px] w-full flex-col items-center justify-center rounded-2xl border border-line bg-canvas text-center">
            <p className="text-[16px] font-semibold text-ink-strong">PDF 뷰어</p>
            <p className="mt-1 text-[16px] text-ink-strong">{pdf?.blindedName}</p>
            <a
              href={pdf?.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-[16px] font-semibold text-brand-blue hover:underline"
            >
              새 창에서 열기
            </a>
          </div>
        )}
        <p className="mt-3 text-[16px] text-ink-strong">
          파일명·PDF 내부 식별정보 제거는 서버가 처리합니다. 배정되지 않은 작품 접근은 서버에서 차단됩니다.
        </p>
      </div>

      {/* RIGHT — rubric + comment */}
      <div className="min-w-0">
        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">심사 항목</h2>
            <span className="text-[16px] font-semibold text-ink-strong">
              {total} / {totalMax}
            </span>
          </div>
          <p className="mt-1 text-[16px] text-ink-strong">배점은 서버 설정값입니다.</p>

          <div className="mt-4 flex flex-col gap-4">
            {rubric.map((c) => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[16px] font-semibold text-ink-strong">{c.label}</span>
                  <span className="text-[16px] text-ink-strong">/ {c.maxScore}</span>
                </div>
                <p className="mt-0.5 text-[16px] text-ink-strong">{c.description}</p>
                <input
                  type="number"
                  min={0}
                  max={c.maxScore}
                  disabled={locked}
                  value={scores[c.id] ?? ""}
                  onChange={(e) => setScore(c.id, c.maxScore, e.target.value)}
                  className="mt-2 w-full rounded-lg border border-field bg-canvas px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          <div className="mt-5">
            <span className="text-[16px] font-semibold text-ink-strong">코멘트</span>
            <Textarea
              rows={4}
              disabled={locked}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSaveStatus("idle");
              }}
              className="mt-2"
            />
          </div>

          {/* Save status */}
          {saveStatus === "error" && (
            <Message tone="danger" className="mt-4" title="임시저장 실패">
              {saveErr}
            </Message>
          )}

          {/* Submit conflict / errors */}
          {conflict && (
            <Message tone="warning" className="mt-4" title="동시 수정 충돌">
              <span className="block">{submitErr ?? saveErr}</span>
              <Button size="sm" variant="outline" className="mt-2" onClick={reload}>
                최신 내용 불러오기
              </Button>
            </Message>
          )}
          {!conflict && submitErr && (
            <Message tone="danger" className="mt-4" title="제출 실패">
              {submitErr}
            </Message>
          )}

          {/* Submitted banner */}
          {submitted && !conflict && (
            <Message tone="success" className="mt-4" title="심사 제출 완료">
              {editableAfterSubmit
                ? "제출 후에도 마감 전까지 수정할 수 있습니다."
                : "제출이 확정되어 더 이상 수정할 수 없습니다."}
            </Message>
          )}

          {/* Actions */}
          {!locked && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={onSave} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "저장 중…" : "임시저장"}
              </Button>
              {saveStatus === "saved" && <StatusBadge tone="success">저장 완료</StatusBadge>}
              <Button onClick={onSubmit} disabled={busy}>
                {busy ? "제출 중…" : submitted ? "다시 제출" : "최종 제출"}
              </Button>
            </div>
          )}

          {/* Dev-only outcome simulation (mock mode only) */}
          {!isLive && (
            <div className="mt-6 grid grid-cols-2 gap-3 border-t border-dashed border-field pt-4">
              <label className="block">
                <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-ink-strong">저장(개발용)</span>
                <Select value={saveSim} onChange={(e) => setSaveSim(e.target.value as SaveScenario)} className="mt-1">
                  <option value="ok">성공</option>
                  <option value="fail">실패</option>
                </Select>
              </label>
              <label className="block">
                <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-ink-strong">제출(개발용)</span>
                <Select value={submitSim} onChange={(e) => setSubmitSim(e.target.value as SubmitScenario)} className="mt-1">
                  <option value="ok">성공</option>
                  <option value="conflict">동시 수정 충돌</option>
                </Select>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
