// Structured, bilingual DETAIL content for the Leipzig 2027 competition page.
//
// Claude-owned structured static *display copy* (per docs/backend/frontend-resolution.md §7).
// It must NOT re-declare domain contract types (Competition/Money/Entry) owned by
// Codex in `src/contracts/`. Authoritative operational values (exact fee, deadline,
// enforcement) come from the server competition spec; text here is display copy.
//
// Rules honoured here:
//  - The €70 entry fee is stated as the ONLY payment at entry; finalist-stage
//    costs are a separate, post-selection concern and are NOT collected on-site.
//  - Undecided policy (exact age brackets, exhibition self-cost, terms document)
//    is marked `pending` / "준비 중" — never fabricated.
//  - The exhibition name/venue stays "planned" until local approval; no official
//    event name, logo, or confirmed-participation wording is asserted.

import type { I18n } from "./leipzig-home";
import { KEY_DATES, FINALISTS, LEIPZIG_SLUG } from "./leipzig-home";

export { KEY_DATES, FINALISTS, LEIPZIG_SLUG };
export type { I18n };

/** A value that is either confirmed copy or an explicit "being finalized" state.
 *  Renders a marked "준비 중" chip when `pending`, so unknowns are never faked. */
export type Maybe = { pending: true } | { pending?: false; value: I18n };
export const confirmed = (value: I18n): Maybe => ({ value });
export const pending: Maybe = { pending: true };

export const DETAIL_META = {
  eyebrow: { en: "GYCA Awards · Leipzig 2027", ko: "GYCA 어워드 · 라이프치히 2027" } satisfies I18n,
  title: {
    en: "2027 GYCA International Youth Art Book Awards",
    ko: "2027 GYCA 국제 청소년 아트북 어워드",
  } satisfies I18n,
  summary: {
    en: "An international art book competition for creators aged 7–18. Enter one PDF; up to 30 finalists exhibit in Leipzig.",
    ko: "만 7–18세 창작자를 위한 국제 아트북 공모입니다. PDF 한 편으로 접수하고, 최대 30작품이 라이프치히에서 전시됩니다.",
  } satisfies I18n,
};

// § Core information + fee (핵심 정보와 참가비)
export const CORE = {
  title: { en: "Key information", ko: "핵심 정보" } satisfies I18n,
  facts: [
    { label: { en: "Competition", ko: "공모명" }, value: confirmed({ en: "2027 GYCA International Youth Art Book Awards", ko: "2027 GYCA 국제 청소년 아트북 어워드" }) },
    { label: { en: "Eligibility", ko: "참가 자격" }, value: confirmed({ en: "Ages 7–18", ko: "만 7–18세" }) },
    { label: { en: "Entry fee", ko: "출품비" }, value: confirmed({ en: "€70 per work", ko: "작품당 €70" }) },
    { label: { en: "Entry period", ko: "접수 기간" }, value: confirmed({ en: "14 Sep – 31 Dec 2026", ko: "2026.09.14 – 12.31" }) },
    { label: { en: "Host city", ko: "개최 도시" }, value: confirmed({ en: "Leipzig, Germany", ko: "독일 라이프치히" }) },
    { label: { en: "Exhibition", ko: "전시" }, value: pending },
  ] satisfies { label: I18n; value: Maybe }[],
  // Reinforce the fee boundary right where the fee is shown.
  feeNote: {
    en: "€70 is the only payment required to enter. It is charged once per work at submission.",
    ko: "접수 시 결제하는 금액은 작품당 €70의 출품비뿐입니다.",
  } satisfies I18n,
} as const;

// § Age divisions & entry categories (연령 부문 및 참가 카테고리)
export const DIVISIONS = {
  title: { en: "Divisions & categories", ko: "연령 부문 및 참가 카테고리" } satisfies I18n,
  intro: {
    en: "Open to individual creators aged 7–18. The first launch runs a single entry category — the art book.",
    ko: "만 7–18세 개인 창작자가 참가할 수 있습니다. 첫 공모는 단일 참가 카테고리(아트북)로 운영합니다.",
  } satisfies I18n,
  category: { en: "Art Book", ko: "아트북" } satisfies I18n,
  // Whether entries are judged in separate age brackets follows the official
  // guidelines, which are still being finalised — shown as pending, not invented.
  ageBrackets: pending as Maybe,
  ageBracketsNote: {
    en: "Age-based judging groups, if any, follow the official guidelines (being finalized).",
    ko: "연령별 심사 그룹 적용 여부는 공모요강에 따르며, 현재 준비 중입니다.",
  } satisfies I18n,
} as const;

// § Submission spec & required materials (제출 규격과 필수 자료)
export const SUBMISSION = {
  title: { en: "Submission & required materials", ko: "제출 규격과 필수 자료" } satisfies I18n,
  specs: [
    { label: { en: "Format", ko: "형식" }, value: confirmed({ en: "A single PDF file", ko: "단일 PDF 파일" }) },
    { label: { en: "Length", ko: "분량" }, value: confirmed({ en: "20+ pages including the cover", ko: "표지 포함 20쪽 이상" }) },
    { label: { en: "Works per entry", ko: "출품 수량" }, value: confirmed({ en: "One work per entry", ko: "1건당 1작품" }) },
    { label: { en: "Title language", ko: "제목 언어" }, value: confirmed({ en: "English title required", ko: "제목은 영문 표기" }) },
    { label: { en: "Max file size", ko: "파일 용량" }, value: pending },
  ] satisfies { label: I18n; value: Maybe }[],
  materials: {
    title: { en: "Required at entry", ko: "접수 시 필수 자료" } satisfies I18n,
    items: [
      { en: "The art book (single PDF)", ko: "아트북 (단일 PDF)" },
      { en: "Participant details", ko: "참가자 정보" },
      { en: "Guardian consent (for minors)", ko: "보호자 동의 (미성년자)" },
    ] satisfies I18n[],
  },
} as const;

// § Judging criteria (심사 기준)
export const JUDGING = {
  title: { en: "Judging criteria", ko: "심사 기준" } satisfies I18n,
  criteria: [
    { label: { en: "Originality", ko: "창의성" }, note: { en: "A distinctive idea and voice.", ko: "독창적인 아이디어와 표현." } },
    { label: { en: "Theme & narrative", ko: "주제·서사" }, note: { en: "Clarity and depth of the story.", ko: "이야기의 명확성과 깊이." } },
    { label: { en: "Expression", ko: "표현력" }, note: { en: "Visual and editorial craft.", ko: "시각·편집 완성도." } },
    { label: { en: "Completion", ko: "완성도" }, note: { en: "How resolved the book feels.", ko: "작품으로서의 완결성." } },
    { label: { en: "Potential", ko: "발전 가능성" }, note: { en: "Room to grow as a creator.", ko: "창작자로서의 성장 가능성." } },
  ] satisfies { label: I18n; note: I18n }[],
  reviewNote: {
    en: "Reviewed by an international jury. Exact weighting follows the official guidelines.",
    ko: "국제 심사위원단이 심사하며, 세부 배점은 공모요강에 따릅니다.",
  } satisfies I18n,
} as const;

// § Official Selection & Finalist (Official Selection과 Finalist 안내)
export const SELECTION = {
  title: { en: "Official Selection & Finalist", ko: "Official Selection과 Finalist 안내" } satisfies I18n,
  stages: [
    {
      key: "official_selection",
      name: { en: "Official Selection", ko: "Official Selection" },
      note: {
        en: "Entries that pass the first international review are named Official Selection and receive a certificate.",
        ko: "1차 국제심사를 통과한 작품은 Official Selection으로 선정되며 인증서를 받습니다.",
      },
    },
    {
      key: "finalist",
      name: { en: "Leipzig Finalist", ko: "Leipzig Finalist" },
      note: {
        en: "Up to 30 works advance as Finalists and are exhibited at the Leipzig international exhibition.",
        ko: "최대 30작품이 Finalist로 진출해 라이프치히 국제전시에 전시됩니다.",
      },
    },
  ],
} as const;

// § Certificates (인증서 안내)
export const CERTIFICATES = {
  title: { en: "Certificates", ko: "인증서 안내" } satisfies I18n,
  intro: {
    en: "Certificates are issued digitally and verifiable.",
    ko: "인증서는 디지털로 발급되며 진위 확인이 가능합니다.",
  } satisfies I18n,
  items: [
    { name: { en: "Official Selection Certificate", ko: "Official Selection 인증서" }, when: { en: "On selection", ko: "선정 시" } },
    { name: { en: "Finalist Certificate", ko: "Finalist 인증서" }, when: { en: "On advancing to finals", ko: "본선 진출 시" } },
  ] satisfies { name: I18n; when: I18n }[],
} as const;

// § Exhibition support & self-cost (전시 지원 및 본인부담금)
// This is where the €70 / finalist-cost boundary is spelled out most explicitly.
export const EXHIBITION = {
  title: { en: "Exhibition support & costs", ko: "전시 지원 및 본인부담금" } satisfies I18n,
  // Reuse the single source of truth for the planned/pending exhibition.
  plannedName: FINALISTS.exhibition.plannedName,
  approvalStatus: FINALISTS.exhibition.approvalStatus,
  venueNote: FINALISTS.exhibition.venueNote,
  provided: {
    title: { en: "Provided by GYCA", ko: "GYCA 제공" } satisfies I18n,
    items: [
      { en: "Exhibition of finalist works", ko: "Finalist 작품 전시" },
      { en: "Finalist Certificate", ko: "Finalist 인증서" },
      { en: "Artist profile & book showcase", ko: "작가 프로필·북 쇼케이스" },
      { en: "Photo & video record", ko: "사진·영상 기록" },
    ] satisfies I18n[],
  },
  selfCost: {
    title: { en: "Possible participant costs", ko: "본인부담 가능 항목" } satisfies I18n,
    // Amounts are not set here; they are announced after selection.
    items: [
      { en: "Travel & accommodation (if attending in person)", ko: "현지 방문 시 교통·숙박" },
      { en: "Artwork shipping (if applicable)", ko: "작품 운송 (해당 시)" },
      { en: "Optional on-site programs", ko: "선택 현장 프로그램" },
    ] satisfies I18n[],
    amount: pending as Maybe,
  },
  // The hard boundary, stated plainly.
  boundaryNote: {
    en: "Entry costs €70 and nothing more at submission. Any finalist-stage costs are separate, announced only after selection, and are NOT collected on this site at this stage.",
    ko: "접수 단계 비용은 €70 출품비가 전부입니다. 본선 관련 비용은 별도이며 선정 이후에만 안내되고, 현재 단계에서는 이 사이트에서 결제하지 않습니다.",
  } satisfies I18n,
} as const;

// § FAQ + terms (FAQ와 약관 연결)
export const FAQ = {
  title: { en: "FAQ", ko: "자주 묻는 질문" } satisfies I18n,
  items: [
    {
      q: { en: "How much does it cost to enter?", ko: "참가 비용은 얼마인가요?" },
      a: { en: "€70 per work, charged once at submission. There are no other fees to enter.", ko: "작품당 €70이며 접수 시 1회 결제합니다. 그 외 접수 비용은 없습니다." },
    },
    {
      q: { en: "Do finalists pay extra?", ko: "본선에 진출하면 추가 비용이 있나요?" },
      a: { en: "Any finalist-stage costs (e.g., travel) are separate and announced after selection. Nothing extra is collected here now.", ko: "본선 관련 비용(예: 교통)은 별도이며 선정 이후 안내됩니다. 현재 이 사이트에서 추가로 결제하지 않습니다." },
    },
    {
      q: { en: "Who can enter?", ko: "누가 참가할 수 있나요?" },
      a: { en: "Individual creators aged 7–18. Minors need guardian consent.", ko: "만 7–18세 개인 창작자입니다. 미성년자는 보호자 동의가 필요합니다." },
    },
    {
      q: { en: "What do I submit?", ko: "무엇을 제출하나요?" },
      a: { en: "One art book as a single PDF of 20+ pages including the cover.", ko: "표지 포함 20쪽 이상의 아트북 한 편을 단일 PDF로 제출합니다." },
    },
  ] satisfies { q: I18n; a: I18n }[],
  // Terms/guidelines are linked only when publicly approved (resolution §3).
  termsReady: false,
  termsPendingNote: {
    en: "Full guidelines and terms are being prepared and will be linked here.",
    ko: "공모요강과 약관은 준비 중이며 확정되면 이곳에 연결됩니다.",
  } satisfies I18n,
} as const;
