"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { Message, StatusBadge, type Tone } from "@/components/ds";
import {
  listJudgeAssignments,
  type JudgeAssignment,
  type JudgeReviewState,
  type JudgeScenario,
} from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";
import { isLive } from "@/lib/api/mode";

// Judge — 배정 작품 목록 (MOCK, BLIND). The list uses a dedicated blind data type
// (JudgeAssignment) with NO participant identity — not participant data hidden by
// CSS. Access to unassigned works is blocked by the server (forbidden scenario).

const REVIEW_STATE: Record<JudgeReviewState, { label: string; tone: Tone }> = {
  not_started: { label: "미심사", tone: "neutral" },
  in_progress: { label: "작성 중", tone: "info" },
  submitted: { label: "제출 완료", tone: "success" },
};

export default function JudgeDashboard() {
  const [scenario, setScenario] = useState<JudgeScenario>("some");
  const [state, setState] = useState<RequestState<JudgeAssignment[]>>({ kind: "loading" });
  const reqId = useRef(0);

  const load = useCallback((sc: JudgeScenario) => {
    const my = ++reqId.current;
    listJudgeAssignments({ scenario: sc, delayMs: 300 }).then((r) => {
      if (my === reqId.current) setState(r);
    });
  }, []);

  useEffect(() => {
    load(scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (sc: JudgeScenario) => {
    setScenario(sc);
    setState({ kind: "loading" });
    load(sc);
  };

  const items = state.kind === "success" ? state.data : [];
  const counts = {
    not_started: items.filter((i) => i.reviewState === "not_started").length,
    in_progress: items.filter((i) => i.reviewState === "in_progress").length,
    submitted: items.filter((i) => i.reviewState === "submitted").length,
  };

  return (
    <>
      <PageHeader
        eyebrow="Judge"
        title="배정 작품"
        description="배정된 작품을 블라인드로 심사합니다. 참가자 식별정보는 제공되지 않습니다."
        crumbs={[{ label: "심사위원" }, { label: "배정 작품" }]}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {/* Dev scenario bar (mock mode only) */}
        {!isLive && (
          <div className="mb-6 rounded-xl border border-dashed border-field bg-canvas px-4 py-3">
            <p className="mb-2 text-[14px] font-bold uppercase tracking-[0.12em] text-ink-strong/70">
              개발용 시나리오 (mock)
            </p>
            <div className="flex flex-wrap gap-2">
              {([["some", "정상"], ["empty", "빈 목록"], ["forbidden", "권한 없음"]] as [JudgeScenario, string][]).map(
                ([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => change(v)}
                    className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                      scenario === v ? "border-black bg-black text-white" : "border-field text-ink hover:border-black"
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        {/* State counts */}
        {state.kind === "success" && (
          <div className="mb-6 flex flex-wrap gap-2">
            <StatusBadge tone="neutral">미심사 {counts.not_started}</StatusBadge>
            <StatusBadge tone="info">작성 중 {counts.in_progress}</StatusBadge>
            <StatusBadge tone="success">제출 완료 {counts.submitted}</StatusBadge>
          </div>
        )}

        {state.kind === "loading" && <p className="text-[16px] text-ink-strong">불러오는 중…</p>}
        {state.kind === "empty" && (
          <div className="rounded-2xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
            <p className="text-[16px] text-ink-strong">배정된 작품이 없습니다.</p>
          </div>
        )}
        {state.kind === "error" && (
          <Message tone="danger" title="접근할 수 없습니다">
            <span className="block">
              {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED"
                ? "배정된 작품이 없거나 심사 접근 권한이 없습니다."
                : "목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
            </span>
          </Message>
        )}
        {state.kind === "success" && (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[640px] text-left text-[16px]">
              <thead>
                <tr className="border-b border-line bg-surface text-ink-strong">
                  <th className="px-5 py-3 font-semibold">블라인드 코드</th>
                  <th className="px-5 py-3 font-semibold">부문</th>
                  <th className="px-5 py-3 font-semibold">연령</th>
                  <th className="px-5 py-3 font-semibold">심사 상태</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {items.map((w) => (
                  <tr key={w.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4 font-semibold text-ink-strong">{w.code}</td>
                    <td className="px-5 py-4 text-ink-strong">{w.category}</td>
                    <td className="px-5 py-4 text-ink-strong">{w.ageGroup}</td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={REVIEW_STATE[w.reviewState].tone}>
                        {REVIEW_STATE[w.reviewState].label}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/judge/review/${w.id}`} className="text-[16px] font-semibold text-brand-blue hover:underline">
                        {w.reviewState === "submitted" ? "심사 보기" : "심사하기"}
                      </Link>
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
