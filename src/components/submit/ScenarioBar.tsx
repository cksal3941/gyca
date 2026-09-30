"use client";

import type { Scenario } from "@/lib/mock/submit-machine";
import type { Locale } from "@/lib/i18n";

// DEV-ONLY scenario switcher, so reviewers can reproduce every required flow
// (happy path + failures). Clearly labelled as a mock control; it is not part of
// the real submission UI and would be removed/guarded before production.

const SCENARIOS: { value: Scenario; label: { en: string; ko: string } }[] = [
  { value: "happy", label: { en: "Happy path", ko: "정상 흐름" } },
  { value: "resume", label: { en: "Resume draft", ko: "이어쓰기" } },
  { value: "saveFail", label: { en: "Save fails", ko: "임시저장 실패" } },
  { value: "pdfReject", label: { en: "PDF rejected", ko: "PDF 검증 실패" } },
  { value: "uploadAbort", label: { en: "Upload abort", ko: "업로드 중단" } },
  { value: "payCancel", label: { en: "Payment cancelled", ko: "결제 취소" } },
  { value: "approvalDelay", label: { en: "Approval delayed", ko: "승인 지연" } },
  { value: "receiptDelay", label: { en: "Receipt delayed", ko: "접수 확인 지연" } },
  { value: "deadlinePassed", label: { en: "Deadline passed", ko: "마감 이후" } },
];

export default function ScenarioBar({
  scenario,
  onChange,
  locale,
}: {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  locale: Locale;
}) {
  const ko = locale === "ko";
  return (
    <div className="rounded-xl border border-dashed border-field bg-canvas px-4 py-3">
      <p className="mb-2 text-[14px] font-bold uppercase tracking-[0.12em] text-ink-strong/70">
        {ko ? "개발용 시나리오 (mock)" : "Dev scenarios (mock)"}
      </p>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
              scenario === s.value
                ? "border-black bg-black text-white"
                : "border-field text-ink hover:border-black hover:text-ink-strong"
            }`}
          >
            {s.label[locale]}
          </button>
        ))}
      </div>
    </div>
  );
}
