// Structured, bilingual HOME content for the first launch (Leipzig 2027).
//
// This is Claude-owned *structured static content* (per docs/backend/frontend-resolution.md §7),
// NOT a domain transport type. It must not re-declare shared Competition/Entry/Money
// contract types (those are owned by Codex in `src/contracts/`).
//
// Copy is sourced from `GYCA_Leipzig_2027_UIUX_기획서.docx` §4–§6/§11–§12.
// Authoritative operational values (fee, deadline, submission rules) come from the
// server competition spec once available; text here is display copy only.
//
// Undecided operational policy is expressed as "planned / 준비 중", never fabricated.

export type Locale = "en" | "ko";

/** Bilingual string. Render `.en` by default; KO is ready for the language toggle
 *  (toggle wiring is deferred pending routing/auth coordination with Codex). */
export type I18n = { en: string; ko: string };

export const pick = (v: I18n, locale: Locale) => v[locale];

export const HERO = {
  brand: "GYCA AWARDS",
  headline: {
    en: "YOUR BOOK. YOUR STORY. NEXT STOP, LEIPZIG.",
    ko: "당신의 책, 당신의 이야기. 다음 무대는 라이프치히.",
  } satisfies I18n,
  competition: {
    en: "2027 GYCA International Youth Art Book Awards",
    ko: "2027 GYCA 국제 청소년 아트북 어워드",
  } satisfies I18n,
  openCall: {
    en: "OPEN CALL · 14 SEP – 31 DEC 2026",
    ko: "접수 · 2026.09.14 – 12.31",
  } satisfies I18n,
  // Hero shows only the two core promises (brief §11).
  promises: [
    {
      en: "GYCA Official Selection Certificate",
      ko: "GYCA Official Selection 인증서",
    },
    {
      en: "Up to 30 Finalists exhibit in Leipzig",
      ko: "최대 30작품 라이프치히 국제전시 진출",
    },
  ] satisfies I18n[],
  primaryCta: { en: "Apply Now", ko: "작품 접수" } satisfies I18n,
  secondaryCta: {
    en: "View Competition",
    ko: "공모 자세히 보기",
  } satisfies I18n,
} as const;

export const WHY = {
  title: { en: "Why Participate", ko: "참가 혜택" } satisfies I18n,
  items: [
    { en: "International Jury", ko: "국제 심사위원단" },
    { en: "Official Selection Certificate", ko: "Official Selection 인증서" },
    { en: "Leipzig International Exhibition", ko: "라이프치히 국제전시" },
    { en: "Global Artist Archive", ko: "글로벌 아티스트 아카이브" },
    { en: "Book Showcase", ko: "북 쇼케이스" },
    { en: "Professional Exhibition Record", ko: "전문 전시 이력" },
  ] satisfies I18n[],
} as const;

export const JOURNEY = {
  title: { en: "The Journey", ko: "진행 여정" } satisfies I18n,
  steps: [
    {
      key: "entry",
      label: { en: "Entry", ko: "접수" },
      note: {
        en: "Submit your art book and complete entry.",
        ko: "아트북을 제출하고 접수를 완료합니다.",
      },
    },
    {
      key: "official_selection",
      label: { en: "Official Selection", ko: "Official Selection" },
      note: {
        en: "Pass the first international review.",
        ko: "1차 국제심사를 통과합니다.",
      },
    },
    {
      key: "finalist",
      label: { en: "Leipzig Finalist", ko: "Leipzig Finalist" },
      note: {
        en: "Selected among up to 30 finalists.",
        ko: "최대 30작품의 본선에 선정됩니다.",
      },
    },
    {
      key: "global_stage",
      label: { en: "Global Stage", ko: "글로벌 무대" },
      note: {
        en: "Exhibit your work on the international stage.",
        ko: "국제 무대에서 작품을 전시합니다.",
      },
    },
  ],
} as const;

// Key dates (brief §4 Section 4). `status: "planned"` marks dates whose exact
// enforcement is server-authoritative and not yet operationally confirmed.
export const KEY_DATES = {
  title: { en: "Key Dates", ko: "주요 일정" } satisfies I18n,
  timezoneNote: {
    en: "All times shown in KST (Asia/Seoul).",
    ko: "모든 시각은 KST(Asia/Seoul) 기준입니다.",
  } satisfies I18n,
  rows: [
    {
      label: { en: "Open Call", ko: "공고" },
      value: { en: "14 Sep 2026", ko: "2026.09.14" },
    },
    {
      label: { en: "Entry Deadline", ko: "접수 마감" },
      value: { en: "31 Dec 2026 · 23:59 KST", ko: "2026.12.31 · 23:59 KST" },
    },
    {
      label: { en: "First Review", ko: "1차 심사" },
      value: { en: "1–8 Jan 2027", ko: "2027.01.01–08" },
    },
    {
      label: { en: "Official Selection", ko: "Official Selection 발표" },
      value: { en: "11 Jan 2027", ko: "2027.01.11" },
    },
    {
      label: { en: "Leipzig Finalist", ko: "Leipzig Finalist 발표" },
      value: { en: "18 Jan 2027", ko: "2027.01.18" },
    },
    {
      label: { en: "Exhibition", ko: "전시" },
      value: { en: "18–21 Mar 2027", ko: "2027.03.18–21" },
    },
  ],
} as const;

export const FINALISTS = {
  title: {
    en: "Finalists Go to Leipzig",
    ko: "Finalist는 라이프치히로",
  } satisfies I18n,
  lead: {
    en: "Up to 30 works advance to the international exhibition.",
    ko: "최대 30작품이 국제전시에 진출합니다.",
  } satisfies I18n,
  gains: [
    { en: "International exhibition", ko: "국제전시" },
    { en: "Finalist Certificate", ko: "Finalist 인증서" },
    { en: "Artist profile", ko: "작가 프로필" },
    { en: "Book Showcase", ko: "북 쇼케이스" },
    { en: "QR Book Connection", ko: "QR 북 커넥션" },
    { en: "Photo & video record", ko: "사진·영상 기록" },
  ] satisfies I18n[],
  // Exhibition naming/venue is pending local approval (brief §12). Public copy
  // must use "planned" wording until approved; never assert an unapproved venue.
  exhibition: {
    approvalStatus: "pending" as "pending" | "approved",
    plannedName: {
      en: "2027 GYCA Leipzig International Exhibition (planned)",
      ko: "2027 GYCA 라이프치히 국제전시 (예정)",
    } satisfies I18n,
    venueNote: {
      en: "Venue and official event name to be confirmed on local approval.",
      ko: "전시장·공식 행사명은 현지 승인 후 확정됩니다.",
    } satisfies I18n,
  },
} as const;

// Section 5 · Fee & submission-spec summary (brief §5/§6). Summary only — the
// full spec lives on the Leipzig detail page (no repetition across sections).
// The €70 entry fee is kept clearly separate from any finalist-stage cost.
export const FEE_SPEC = {
  title: { en: "Fee & Submission", ko: "참가비와 출품 규격" } satisfies I18n,
  feeLabel: { en: "Entry fee", ko: "출품비" } satisfies I18n,
  fee: { en: "€70", ko: "€70" } satisfies I18n,
  feeUnit: { en: "per work", ko: "작품당" } satisfies I18n,
  // Specs shown as short chips; details are on the Leipzig page.
  specs: [
    { label: { en: "Eligibility", ko: "참가 자격" }, value: { en: "Ages 7–18", ko: "만 7–18세" } },
    { label: { en: "Format", ko: "형식" }, value: { en: "Single PDF", ko: "단일 PDF" } },
    { label: { en: "Length", ko: "분량" }, value: { en: "20+ pages incl. cover", ko: "표지 포함 20쪽 이상" } },
    { label: { en: "Language", ko: "언어" }, value: { en: "Any (title in English)", ko: "제한 없음 (제목은 영문)" } },
  ] satisfies { label: I18n; value: I18n }[],
  // Costs beyond entry (finalist exhibition support) are separate and announced
  // later — never bundled into the €70 (brief: keep the two clearly separate).
  costSeparationNote: {
    en: "The €70 entry fee is the only payment at entry. Any finalist-stage exhibition costs are separate and announced after selection.",
    ko: "출품 단계에서 결제하는 금액은 €70 출품비뿐입니다. 본선(Finalist) 전시 관련 비용은 별도이며 선정 이후 안내됩니다.",
  } satisfies I18n,
  detailCta: { en: "See full requirements", ko: "출품 규격 자세히 보기" } satisfies I18n,
} as const;

// Section 6 · Klimt Villa — completed project teaser (Archive, NOT an open call).
// Links to the reusable project archive. No fabricated figures here.
export const KLIMT_TEASER = {
  eyebrow: { en: "Completed Project · Archive", ko: "완료 프로젝트 · 아카이브" } satisfies I18n,
  title: {
    en: "Klimt Villa Youth Art Project, Vienna",
    ko: "클림트 빌라 청소년 아트 프로젝트, 비엔나",
  } satisfies I18n,
  summary: {
    en: "A completed GYCA program in Vienna — from open call and selection to a Klimt Villa exhibition, an awards ceremony, artwork sales, and issued certificates.",
    ko: "비엔나에서 진행된 완료 프로젝트입니다. 공모·선정부터 클림트 빌라 전시, 수여식, 작품 판매, 인증서 발급까지 운영했습니다.",
  } satisfies I18n,
  // What was actually operated (no numbers asserted here).
  operated: [
    { en: "Exhibition", ko: "전시" },
    { en: "Awards ceremony", ko: "수여식" },
    { en: "Artwork sales", ko: "작품 판매" },
    { en: "Certificates", ko: "인증서" },
  ] satisfies I18n[],
  cta: { en: "View the archive", ko: "아카이브 보기" } satisfies I18n,
} as const;

export const APPLY = {
  title: { en: "Ready to Apply?", ko: "지금 접수하세요" } satisfies I18n,
  feeLabel: { en: "Entry fee", ko: "참가비" } satisfies I18n,
  fee: { en: "€70 per work", ko: "작품당 €70" } satisfies I18n,
  primaryCta: { en: "Apply Now", ko: "작품 접수" } satisfies I18n,
  // Guidelines/terms are provided only when publicly approved (resolution §3).
  guidelinesReady: false,
  guidelinesPendingNote: {
    en: "Full guidelines and terms are being prepared.",
    ko: "공모요강과 약관은 준비 중입니다.",
  } satisfies I18n,
} as const;

/** Where the primary Apply CTA points. Kept in one place so it can later be
 *  gated by the server competition `allowedActions` (start_entry). */
export const LEIPZIG_SLUG = "leipzig-2027";
export const APPLY_HREF = `/submit?contest=${LEIPZIG_SLUG}`;
export const DETAIL_HREF = `/contests/${LEIPZIG_SLUG}`;

/** Klimt Villa archive route (Archive, not an open call). */
export const KLIMT_ARCHIVE_HREF = "/archive/klimt-villa";
