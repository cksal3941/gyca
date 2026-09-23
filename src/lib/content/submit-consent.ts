// Consent documents shown in the submit flow (display copy, Claude-owned).
//
// Codex decision: only the three REQUIRED consents are connected to the real
// submit request — participation_rules / privacy / work_license. Guardian
// verification is a separate procedure (not a consent checkbox here). The real
// API never receives an arbitrary marketing consent.
//
// Optional consents are DATA-DRIVEN: if the list is empty, the UI renders nothing
// (no heading, no checkbox, no empty box). The single optional item below exists
// ONLY for the "full version" demo and is flagged `demoOnly` so it is excluded
// from the first-launch fixture and the real adapter.

import type { Bi } from "@/lib/i18n";

export type ConsentKind = "participation_rules" | "privacy" | "work_license";

export type ConsentDoc = {
  kind: ConsentKind;
  version: string;
  required: true;
  title: Bi;
  /** Short summary shown inline; full text opens in a dialog (link/plain here). */
  summary: Bi;
};

/** The three required consents (match contract CONSENT_KINDS). Final legal text
 *  is confirmed separately by Codex; copy here is placeholder display summary. */
export const REQUIRED_CONSENTS: ConsentDoc[] = [
  {
    kind: "participation_rules",
    version: "2027.1",
    required: true,
    title: { en: "Competition rules", ko: "참가 규정" },
    summary: {
      en: "I have read and agree to the Leipzig 2027 competition rules.",
      ko: "라이프치히 2027 참가 규정을 읽고 동의합니다.",
    },
  },
  {
    kind: "privacy",
    version: "2027.1",
    required: true,
    title: { en: "Privacy notice & consent", ko: "개인정보 수집·이용 동의" },
    summary: {
      en: "I consent to the collection and use of personal data needed to process this entry.",
      ko: "접수 처리를 위한 개인정보 수집·이용에 동의합니다.",
    },
  },
  {
    kind: "work_license",
    version: "2027.1",
    required: true,
    title: { en: "Work usage license", ko: "작품 이용허락" },
    summary: {
      en: "I grant permission to exhibit, publish, and promote the submitted work for the program.",
      ko: "제출 작품을 프로그램의 전시·출판·홍보 목적으로 이용하도록 허락합니다.",
    },
  },
];

/** Optional consent — DEMO ONLY. Present only in the "full version" mock to show
 *  the data-driven optional area. NOT sent to the real API; NOT in first-launch.
 *  A real marketing-email consent would be added by Codex with its own contract,
 *  purpose, channel, wording, withdrawal, and minor handling — and must never
 *  block entry or payment. */
export type OptionalConsentDemo = {
  key: string;
  demoOnly: true;
  title: Bi;
  summary: Bi;
};

export const OPTIONAL_CONSENTS_DEMO: OptionalConsentDemo[] = [
  {
    key: "marketing_email",
    demoOnly: true,
    title: { en: "Event & marketing emails (optional)", ko: "행사·마케팅 이메일 수신 (선택)" },
    summary: {
      en: "Receive news about future GYCA programs. Optional — does not affect your entry.",
      ko: "향후 GYCA 프로그램 소식을 받아봅니다. 선택 항목이며 접수에 영향을 주지 않습니다.",
    },
  },
];
