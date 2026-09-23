// Presentation helpers for entries, shared by My Page and the entry detail /
// payment routes. Every value here is DERIVED FROM SERVER FACTS (entryStatus,
// reviewStatus, publishedResult, payment.state, blockingReasons) — this module
// never re-decides those facts, and the client never invents allowed actions.

import { getCompetitionSync } from "@/lib/api";
import type { EntrySummary, PaymentState, ErrorCode } from "@/contracts";
import type { Tone } from "@/components/ds";
import type { Bi, Locale } from "@/lib/i18n";

export const money = (amountMinor: number) =>
  `€${(amountMinor / 100).toFixed(amountMinor % 100 === 0 ? 0 : 2)}`;

export const fmtDate = (iso: string | null, ko: boolean) =>
  iso
    ? new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

// competitionId → title. EntrySummary carries only the id, so cards/detail look
// the title up from the (mock) competition fixtures.
const COMP_SCENARIOS = ["open-ready", "upcoming", "archived"] as const;

export function competitionTitleById(id: string): Bi {
  for (const s of COMP_SCENARIOS) {
    const r = getCompetitionSync(s);
    if (r.kind === "success" && r.data.id === id) return r.data.title;
  }
  return { en: "—", ko: "—" };
}

export type StatusView = { label: Bi; tone: Tone };

/** Presentation label + tone for an entry, from server-provided facts only. */
export function entryStatusView(e: EntrySummary): StatusView {
  switch (e.entryStatus) {
    case "draft":
      return { label: { en: "Draft", ko: "작성 중" }, tone: "neutral" };
    case "submitted":
      if (e.payment?.state === "pending" || e.blockingReasons.includes("PAYMENT_PENDING"))
        return { label: { en: "Payment pending", ko: "결제 확인 중" }, tone: "warning" };
      if (e.blockingReasons.includes("RECEIPT_PENDING"))
        return { label: { en: "Confirming entry", ko: "접수 확인 중" }, tone: "info" };
      return { label: { en: "Submitted", ko: "제출됨" }, tone: "info" };
    case "received":
      if (e.reviewStatus === "under_review")
        return { label: { en: "Under review", ko: "심사 중" }, tone: "info" };
      if (e.reviewStatus === "completed") return resultView(e.publishedResult);
      return { label: { en: "Received", ko: "접수 완료" }, tone: "success" };
    case "withdrawn":
      return { label: { en: "Withdrawn", ko: "철회됨" }, tone: "neutral" };
    case "expired":
      return { label: { en: "Expired", ko: "만료됨" }, tone: "neutral" };
  }
}

/** Submission-lifecycle label ONLY (no payment/result folded in) — for lists that
 *  show 접수 상태 / 결제 상태 / 심사 결과 as three separate chips. */
export function entryProgressView(e: EntrySummary): StatusView {
  switch (e.entryStatus) {
    case "draft":
      return { label: { en: "Draft", ko: "작성 중" }, tone: "neutral" };
    case "submitted":
      if (e.blockingReasons.includes("RECEIPT_PENDING"))
        return { label: { en: "Confirming entry", ko: "접수 확인 중" }, tone: "info" };
      return { label: { en: "Submitted", ko: "제출됨" }, tone: "info" };
    case "received":
      return { label: { en: "Received", ko: "접수 완료" }, tone: "success" };
    case "withdrawn":
      return { label: { en: "Withdrawn", ko: "철회됨" }, tone: "neutral" };
    case "expired":
      return { label: { en: "Expired", ko: "만료됨" }, tone: "neutral" };
  }
}

export function resultView(result: EntrySummary["publishedResult"]): StatusView {
  switch (result) {
    case "official_selection":
      return { label: { en: "Official Selection", ko: "Official Selection" }, tone: "success" };
    case "finalist":
      return { label: { en: "Leipzig Finalist", ko: "Leipzig Finalist" }, tone: "success" };
    case "not_selected":
      return { label: { en: "Not selected", ko: "미선정" }, tone: "neutral" };
    case null:
      return { label: { en: "Review complete", ko: "심사 완료" }, tone: "info" };
  }
}

/** 1-based step for the [Submit → Payment → Receipt → Review → Result] tracker. */
export function entryStep(e: EntrySummary): number {
  if (e.entryStatus === "draft") return 1;
  if (e.entryStatus === "submitted")
    return e.blockingReasons.includes("RECEIPT_PENDING") || e.payment?.state === "succeeded" ? 3 : 2;
  if (e.entryStatus === "received") return e.reviewStatus === "completed" ? 5 : 4;
  return 1; // withdrawn / expired
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, Bi> = {
  pending: { en: "Pending", ko: "대기" },
  succeeded: { en: "Paid", ko: "결제완료" },
  failed: { en: "Failed", ko: "실패" },
  cancelled: { en: "Cancelled", ko: "취소" },
  expired: { en: "Expired", ko: "만료" },
};

// Localized copy for the error codes our (mock) adapter emits. The server owns
// the free-form `message`; when we recognise the code we prefer localized text
// so an EN screen never shows a Korean-only server string, falling back to the
// server message otherwise.
const ERROR_MESSAGE: Partial<Record<ErrorCode, Bi>> = {
  RATE_LIMITED: {
    en: "Too many requests. Please try again shortly.",
    ko: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
  },
  INTERNAL_ERROR: {
    en: "Something went wrong. Please try again.",
    ko: "문제가 발생했습니다. 다시 시도해 주세요.",
  },
  NOT_FOUND: {
    en: "We couldn't find this entry.",
    ko: "해당 접수를 찾을 수 없습니다.",
  },
  VALIDATION_FAILED: {
    en: "The data could not be validated.",
    ko: "데이터를 확인하지 못했습니다.",
  },
  CONSENT_REQUIRED: {
    en: "The notice changed. Please review and accept it again.",
    ko: "안내가 변경되었습니다. 다시 확인하고 동의해 주세요.",
  },
  IDEMPOTENCY_CONFLICT: {
    en: "An order was already created through another route.",
    ko: "이미 다른 경로로 주문이 생성되었습니다.",
  },
};

export function errorText(code: string, fallback: string, locale: Locale): string {
  const m = ERROR_MESSAGE[code as ErrorCode];
  return m ? m[locale] : fallback;
}
