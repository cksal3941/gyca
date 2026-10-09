// Development mock fixtures — NOT a real API. Do not present as a live connection.
//
// These are RAW (untyped) objects shaped to the shared contracts in `@/contracts`.
// The adapter (`src/lib/api`) validates them with safeParse and returns the
// branded/typed values — this file never re-declares domain types, and never
// asserts strings into branded ids.
//
// Values follow docs/backend/frontend-resolution.md v0.2 and src/contracts/README.md:
//   - every competition has `id` (+ separate `slug`) and `blockingReasons`
//   - work fields use englishTitle / englishDescription (form paths too)
//   - guidelines === null ⇒ no `view_guidelines` action
//   - if required policy is undecided, readiness stays false
//   - undecided policy stays null/false (deadline exact time, maxBytes, age ref date…)
//
// The "open-ready" scenario intentionally fills in a COMPLETE dev test policy
// (maxBytes, ageReferenceDate, requiredOnSubmit, windows) so readiness can be
// true and `start_entry` is offered. These dev values are NOT production policy.

/* ------------------------------------------------------------------ */
/* Competitions                                                        */
/* ------------------------------------------------------------------ */

const LEIPZIG_ID = "comp_leipzig_2027";
const EUR = "EUR";

const leipzigTitle = {
  en: "2027 GYCA International Youth Art Book Awards",
  ko: "2027 GYCA 국제 청소년 아트북 어워드",
};

// Fully-resolved dev form policy (open-ready only). englishTitle/englishDescription
// replace the earlier titleEn/descriptionEn.
const RESOLVED_FORM_SPEC = {
  version: "2027.1",
  ageReferenceDate: "2027-01-01", // dev value — not confirmed production policy
  categories: [
    { id: "picture_book", label: { en: "Picture Book", ko: "그림책" } },
    { id: "art_book", label: { en: "Art Book", ko: "아트북" } },
    { id: "illustrated_story", label: { en: "Illustrated Story", ko: "일러스트 스토리" } },
    { id: "graphic_story", label: { en: "Graphic Story", ko: "그래픽 스토리" } },
    { id: "experimental", label: { en: "Experimental Book Project", ko: "실험적 북 프로젝트" } },
  ],
  ageGroups: [
    { id: "junior", label: { en: "Junior", ko: "주니어" }, minAgeInclusive: 7, maxAgeInclusive: 12 },
    { id: "middle", label: { en: "Middle", ko: "미들" }, minAgeInclusive: 13, maxAgeInclusive: 15 },
    { id: "youth", label: { en: "Youth", ko: "유스" }, minAgeInclusive: 16, maxAgeInclusive: 18 },
  ],
  fields: [
    { path: "work.englishTitle", inputType: "text", requiredOnSubmit: true },
    { path: "work.englishDescription", inputType: "textarea", requiredOnSubmit: true },
    { path: "work.category", inputType: "choice", requiredOnSubmit: true },
    { path: "participant.name", inputType: "text", requiredOnSubmit: true },
    { path: "participant.dateOfBirth", inputType: "date", requiredOnSubmit: true },
    { path: "participant.nameEn", inputType: "text", requiredOnSubmit: false },
    { path: "participant.grade", inputType: "text", requiredOnSubmit: false },
  ],
  uploads: [
    {
      purpose: "cover_image",
      requiredOnSubmit: true,
      allowedMediaTypes: ["image/jpeg", "image/png"],
      maxFiles: 1,
      maxBytes: 10_000_000, // dev value
      minPages: null,
    },
    {
      purpose: "book_pdf",
      requiredOnSubmit: true,
      allowedMediaTypes: ["application/pdf"],
      maxFiles: 1,
      maxBytes: 50_000_000, // dev value
      minPages: 20,
    },
  ],
};

const leipzigKeyDates = [
  { id: "open", label: { en: "Open Call", ko: "공고" }, timezone: "Asia/Seoul", value: { kind: "date", date: "2026-09-14" } },
  { id: "deadline", label: { en: "Entry Deadline", ko: "접수 마감" }, timezone: "Asia/Seoul", value: { kind: "instant", at: "2026-12-31T15:00:00Z" } },
  { id: "review", label: { en: "First Review", ko: "1차 심사" }, timezone: "Asia/Seoul", value: { kind: "date_range", startsOn: "2027-01-01", endsOn: "2027-01-08" } },
  { id: "selection", label: { en: "Official Selection", ko: "Official Selection" }, timezone: "Asia/Seoul", value: { kind: "date", date: "2027-01-11" } },
  { id: "finalist", label: { en: "Leipzig Finalist", ko: "Leipzig Finalist" }, timezone: "Asia/Seoul", value: { kind: "date", date: "2027-01-18" } },
  { id: "exhibition", label: { en: "Exhibition", ko: "전시" }, timezone: "Asia/Seoul", value: { kind: "date_range", startsOn: "2027-03-18", endsOn: "2027-03-21" } },
];

// approvalStatus "pending" ⇒ venueName/logoUrl MUST be null (schema enforces).
const leipzigExhibitionPending = {
  approvalStatus: "pending",
  displayName: { en: "2027 GYCA Leipzig International Exhibition (planned)", ko: "2027 GYCA 라이프치히 국제전시 (예정)" },
  venueName: null,
  logoUrl: null,
  period: { startsOn: "2027-03-18", endsOn: "2027-03-21" },
};

export const RAW_COMPETITIONS = {
  // open + fully ready ⇒ start_entry (+ view_guidelines because guidelines set)
  "open-ready": {
    id: LEIPZIG_ID,
    slug: "leipzig-2027",
    status: "open",
    title: leipzigTitle,
    fee: { amountMinor: 7000, currency: EUR },
    readiness: { application: true, payment: true },
    allowedActions: ["start_entry", "view_guidelines"],
    blockingReasons: [],
    opensAt: "2026-09-14T00:00:00Z",
    submissionClosesAtExclusive: "2026-12-31T15:00:00Z", // dev exclusive end — not confirmed
    paymentClosesAtExclusive: "2026-12-31T15:00:00Z",
    timezone: "Asia/Seoul",
    keyDates: leipzigKeyDates,
    formSpec: RESOLVED_FORM_SPEC,
    exhibition: leipzigExhibitionPending,
    guidelines: { url: "https://gycaawards.com/guidelines/leipzig-2027", locale: "en", version: "1.0" },
  },

  // open by notice but policy not configured ⇒ readiness false, no start_entry,
  // guidelines null ⇒ no view_guidelines either.
  "open-not-ready": {
    id: LEIPZIG_ID,
    slug: "leipzig-2027",
    status: "open",
    title: leipzigTitle,
    fee: { amountMinor: 7000, currency: EUR },
    readiness: { application: false, payment: false },
    allowedActions: [],
    blockingReasons: ["POLICY_NOT_CONFIGURED"],
    opensAt: "2026-09-14T00:00:00Z",
    submissionClosesAtExclusive: null, // undecided
    paymentClosesAtExclusive: null,
    timezone: "Asia/Seoul",
    keyDates: [
      { id: "open", label: { en: "Open Call", ko: "공고" }, timezone: "Asia/Seoul", value: { kind: "date", date: "2026-09-14" } },
      // exact deadline undecided ⇒ value null
      { id: "deadline", label: { en: "Entry Deadline", ko: "접수 마감" }, timezone: "Asia/Seoul", value: null },
    ],
    formSpec: null,
    exhibition: leipzigExhibitionPending,
    guidelines: null,
  },

  upcoming: {
    id: "comp_future_2027",
    slug: "future-genre-2027",
    status: "upcoming",
    title: { en: "Future Genre Award (Coming Soon)", ko: "향후 분야 어워드 (준비 중)" },
    fee: null,
    readiness: { application: false, payment: false },
    allowedActions: [],
    blockingReasons: ["NOT_OPEN_YET"],
    opensAt: null,
    submissionClosesAtExclusive: null,
    paymentClosesAtExclusive: null,
    timezone: "Asia/Seoul",
    keyDates: [],
    formSpec: null,
    exhibition: null,
    guidelines: null,
  },

  // Klimt Villa — completed archive, no new entry.
  archived: {
    id: "comp_klimt_villa",
    slug: "klimt-villa",
    status: "archived",
    title: { en: "Klimt Villa Youth Art Award", ko: "클림트 빌라 청소년 미술상" },
    fee: null,
    readiness: { application: false, payment: false },
    allowedActions: [],
    blockingReasons: ["COMPETITION_ARCHIVED"],
    opensAt: null,
    submissionClosesAtExclusive: null,
    paymentClosesAtExclusive: null,
    timezone: "Europe/Vienna",
    keyDates: [],
    formSpec: null,
    exhibition: null,
    guidelines: null,
  },
};

/* ------------------------------------------------------------------ */
/* Entry summaries (built from a common base + per-scenario overrides) */
/* ------------------------------------------------------------------ */

const ENTRY_BASE = {
  id: "entry_base",
  competitionId: LEIPZIG_ID,
  competitionTitle: leipzigTitle,
  workTitle: "",
  categoryLabel: null,
  revision: 1,
  entryStatus: "draft",
  receiptNumber: null,
  submittedAt: null,
  receivedAt: null,
  payment: null,
  reviewStatus: "not_started",
  publishedResult: null,
  finalParticipation: { state: "not_available", revision: 0, invitationPublishedAt: null, confirmedAt: null, orderId: null, allowedActions: [] },
  guardianVerification: { method: "not_configured", status: "not_required" },
  allowedActions: [],
  blockingReasons: [],
};

const paySucceeded = { orderId: "order_ok", state: "succeeded", amountMinor: 7000, currency: EUR };
const payPending = { orderId: "order_pending", state: "pending", amountMinor: 7000, currency: EUR };

export const RAW_ENTRIES = {
  draft: { ...ENTRY_BASE, id: "entry_draft", categoryLabel: { en: "Picture Book", ko: "그림책" },
    allowedActions: ["edit", "upload"], blockingReasons: ["REQUIRED_FIELDS_MISSING"] },

  // missing required fields + consent + guardian verification (method undecided)
  draftMissing: {
    ...ENTRY_BASE, id: "entry_missing", revision: 3, workTitle: "Paper Planet",
    guardianVerification: { method: "not_configured", status: "required" },
    allowedActions: ["edit", "upload"],
    blockingReasons: ["REQUIRED_FIELDS_MISSING", "CONSENT_REQUIRED", "GUARDIAN_VERIFICATION_REQUIRED"],
  },

  // a rejected PDF blocks the draft (asset carried in RAW_ASSETS)
  draftPdfRejected: {
    ...ENTRY_BASE, id: "entry_pdf_reject", revision: 4, workTitle: "Paper Boats",
    categoryLabel: { en: "Illustrated Story", ko: "일러스트 스토리" },
    guardianVerification: { method: "checkbox", status: "required" },
    allowedActions: ["edit", "upload"], blockingReasons: ["FILE_NOT_READY"],
  },

  // submitted, payment pending ⇒ "결제 확인 중"
  submittedPending: {
    ...ENTRY_BASE, id: "entry_sub_pending", revision: 6, workTitle: "City Lights",
    categoryLabel: { en: "Art Book", ko: "아트북" },
    entryStatus: "submitted", submittedAt: "2026-12-20T09:10:00Z",
    payment: payPending, guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission", "check_payment", "start_payment"], blockingReasons: ["PAYMENT_PENDING"],
  },

  // submitted, payment succeeded, receipt pending ⇒ "접수 확인 중" (no start_payment)
  submittedReceiptPending: {
    ...ENTRY_BASE, id: "entry_receipt_pending", revision: 7, workTitle: "Morning Harbor",
    categoryLabel: { en: "Picture Book", ko: "그림책" },
    entryStatus: "submitted", submittedAt: "2026-12-20T09:10:00Z",
    payment: paySucceeded, guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission", "check_payment"], blockingReasons: ["RECEIPT_PENDING"],
  },

  // received ⇒ receipt issued, under review
  received: {
    ...ENTRY_BASE, id: "entry_received", revision: 8, workTitle: "Quiet Morning",
    categoryLabel: { en: "Picture Book", ko: "그림책" },
    entryStatus: "received", receiptNumber: "GYCA-2027-000123",
    submittedAt: "2026-12-20T09:10:00Z", receivedAt: "2026-12-20T09:12:00Z",
    payment: paySucceeded, reviewStatus: "under_review",
    guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission"], blockingReasons: [],
  },

  officialSelection: {
    ...ENTRY_BASE, id: "entry_official", revision: 9, workTitle: "Quiet Morning",
    categoryLabel: { en: "Picture Book", ko: "그림책" },
    entryStatus: "received", receiptNumber: "GYCA-2027-000200",
    submittedAt: "2026-12-10T09:10:00Z", receivedAt: "2026-12-10T09:12:00Z",
    payment: paySucceeded, reviewStatus: "completed", publishedResult: "official_selection",
    guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission", "download_certificate"], blockingReasons: [],
  },

  // not selected this round (respectful result copy in the UI)
  notSelected: {
    ...ENTRY_BASE, id: "entry_not_selected", revision: 9, workTitle: "Rainy Street",
    categoryLabel: { en: "Graphic Story", ko: "그래픽 스토리" },
    entryStatus: "received", receiptNumber: "GYCA-2027-000150",
    submittedAt: "2026-12-08T09:10:00Z", receivedAt: "2026-12-08T09:12:00Z",
    payment: paySucceeded, reviewStatus: "completed", publishedResult: "not_selected",
    guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission"], blockingReasons: [],
  },

  // finalist result; finals invitation published (display-only — the €1,100 finals
  // fee has no real payment until separately requested).
  finalist: {
    ...ENTRY_BASE, id: "entry_finalist", revision: 10, workTitle: "Harbor at Dawn",
    categoryLabel: { en: "Graphic Story", ko: "그래픽 스토리" },
    entryStatus: "received", receiptNumber: "GYCA-2027-000201",
    submittedAt: "2026-12-05T09:10:00Z", receivedAt: "2026-12-05T09:12:00Z",
    payment: paySucceeded, reviewStatus: "completed", publishedResult: "finalist",
    finalParticipation: { state: "invited", revision: 1, invitationPublishedAt: "2027-01-18T00:00:00Z", confirmedAt: null, orderId: null,
      allowedActions: ["respond_final_participation"] },
    guardianVerification: { method: "checkbox", status: "verified" },
    allowedActions: ["view_submission", "download_certificate"], blockingReasons: [],
  },
};

/* ------------------------------------------------------------------ */
/* Entry draft content (participant / work / guardian), keyed by entry  */
/* id. Merged with the summary above to form an EntryDetail. Drafts have */
/* intentionally sparse data; submitted/received entries are complete.   */
/* ------------------------------------------------------------------ */

export const RAW_ENTRY_EXTRA: Record<
  string,
  { participant: unknown; work: unknown; guardian: unknown }
> = {
  entry_draft: {
    participant: { name: "Mina Seo", nameEn: "Mina Seo", dateOfBirth: "2013-06-02" },
    work: { englishTitle: "", englishDescription: "", category: "picture_book" },
    guardian: { name: "", email: "" },
  },
  entry_missing: {
    participant: { name: "Junho Park", dateOfBirth: "2011-02-18" },
    work: { englishTitle: "Paper Planet", englishDescription: "", category: "" },
    guardian: { name: "", email: "" },
  },
  entry_pdf_reject: {
    participant: { name: "Yuna Kim", nameEn: "Yuna Kim", dateOfBirth: "2010-09-30" },
    work: {
      englishTitle: "Paper Boats",
      englishDescription: "A quiet river carries a fleet of folded boats.",
      category: "illustrated_story",
    },
    guardian: { name: "Sora Kim", email: "sora.kim@example.com" },
  },
  entry_sub_pending: {
    participant: { name: "Daniel Cho", nameEn: "Daniel Cho", dateOfBirth: "2009-11-12" },
    work: {
      englishTitle: "City Lights",
      englishDescription: "A wordless walk through a city that wakes at night.",
      category: "art_book",
    },
    guardian: { name: "Hana Cho", email: "hana.cho@example.com" },
  },
  entry_receipt_pending: {
    participant: { name: "Sofia Lee", nameEn: "Sofia Lee", dateOfBirth: "2012-01-25" },
    work: {
      englishTitle: "Morning Harbor",
      englishDescription: "Fishing boats and gulls greet the first light.",
      category: "picture_book",
    },
    guardian: { name: "Minji Lee", email: "minji.lee@example.com" },
  },
  entry_received: {
    participant: { name: "Ella Park", nameEn: "Ella Park", dateOfBirth: "2011-07-08" },
    work: {
      englishTitle: "Quiet Morning",
      englishDescription: "Sunrise over a sleeping village, told in soft watercolor.",
      category: "picture_book",
    },
    guardian: { name: "Jisoo Park", email: "jisoo.park@example.com" },
  },
  entry_official: {
    participant: { name: "Aria Han", nameEn: "Aria Han", dateOfBirth: "2011-07-08" },
    work: {
      englishTitle: "Quiet Morning",
      englishDescription: "Sunrise over a sleeping village, told in soft watercolor.",
      category: "picture_book",
    },
    guardian: { name: "Jisoo Han", email: "jisoo.han@example.com" },
  },
  entry_finalist: {
    participant: { name: "Noah Jung", nameEn: "Noah Jung", dateOfBirth: "2010-03-14" },
    work: {
      englishTitle: "Harbor at Dawn",
      englishDescription: "A graphic story about a lighthouse keeper's last night.",
      category: "graphic_story",
    },
    guardian: { name: "Eunji Jung", email: "eunji.jung@example.com" },
  },
  entry_not_selected: {
    participant: { name: "Leo Kim", nameEn: "Leo Kim", dateOfBirth: "2012-08-20" },
    work: {
      englishTitle: "Rainy Street",
      englishDescription: "A short comic about umbrellas that never quite dry.",
      category: "graphic_story",
    },
    guardian: { name: "Hyun Kim", email: "hyun.kim@example.com" },
  },
};

/* ------------------------------------------------------------------ */
/* Assets (separate from EntrySummary)                                 */
/* ------------------------------------------------------------------ */

export const RAW_ASSETS = {
  coverReady: { id: "asset_cover", purpose: "cover_image", displayName: "cover.jpg", sizeBytes: 820000, state: "ready", pageCount: null, rejectionCode: null },
  pdfValidating: { id: "asset_pdf_val", purpose: "book_pdf", displayName: "book.pdf", sizeBytes: 5200000, state: "validating", pageCount: null, rejectionCode: null },
  pdfTooFewPages: { id: "asset_pdf_short", purpose: "book_pdf", displayName: "short.pdf", sizeBytes: 1200000, state: "rejected", pageCount: 12, rejectionCode: "PDF_TOO_FEW_PAGES" },
};

/* ------------------------------------------------------------------ */
/* Uploaded files per entry (Asset[] keyed by entry id). Assets are a  */
/* separate contract from EntryDetail, so the detail view reads them   */
/* here. Drafts/rejects carry in-progress states; received entries are */
/* fully ready with a server-confirmed pageCount.                      */
/* ------------------------------------------------------------------ */

const readyCover = (id: string, name: string) => ({
  id, purpose: "cover_image", displayName: name, sizeBytes: 820000, state: "ready", pageCount: null, rejectionCode: null,
});
const readyPdf = (id: string, name: string, pages: number) => ({
  id, purpose: "book_pdf", displayName: name, sizeBytes: 6200000, state: "ready", pageCount: pages, rejectionCode: null,
});

export const RAW_ENTRY_ASSETS: Record<string, readonly unknown[]> = {
  entry_draft: [readyCover("a_draft_cover", "cover-draft.jpg")],
  entry_missing: [],
  entry_pdf_reject: [
    readyCover("a_reject_cover", "cover.jpg"),
    { id: "a_reject_pdf", purpose: "book_pdf", displayName: "short.pdf", sizeBytes: 1200000, state: "rejected", pageCount: 12, rejectionCode: "PDF_TOO_FEW_PAGES" },
  ],
  entry_sub_pending: [readyCover("a_sub_cover", "city-lights-cover.jpg"), readyPdf("a_sub_pdf", "city-lights.pdf", 28)],
  entry_receipt_pending: [readyCover("a_rcpt_cover", "morning-harbor-cover.jpg"), readyPdf("a_rcpt_pdf", "morning-harbor.pdf", 22)],
  entry_received: [readyCover("a_rcv_cover", "quiet-morning-cover.jpg"), readyPdf("a_rcv_pdf", "quiet-morning.pdf", 24)],
  entry_official: [readyCover("a_off_cover", "quiet-morning-cover.jpg"), readyPdf("a_off_pdf", "quiet-morning.pdf", 24)],
  entry_finalist: [readyCover("a_fin_cover", "harbor-at-dawn-cover.jpg"), readyPdf("a_fin_pdf", "harbor-at-dawn.pdf", 32)],
  entry_not_selected: [readyCover("a_ns_cover", "rainy-street-cover.jpg"), readyPdf("a_ns_pdf", "rainy-street.pdf", 20)],
};

/* ------------------------------------------------------------------ */
/* My GYCA lists (empty / populated)                                   */
/* ------------------------------------------------------------------ */

export const RAW_ORDERS = {
  some: [
    {
      id: "order_ok", entryId: "entry_received", competitionTitle: leipzigTitle, workTitle: "Quiet Morning",
      kind: "entry_fee", money: { amountMinor: 7000, currency: EUR }, paymentState: "succeeded",
      createdAt: "2026-12-20T09:11:00Z", refundSummary: null,
    },
  ],
  empty: [],
};

export const RAW_CERTIFICATES = {
  some: [
    // 다운로드 가능 (issued, downloadable)
    {
      id: "cert_official", entryId: "entry_official", competitionTitle: leipzigTitle, workTitle: "Quiet Morning",
      stage: "official_selection", issuedAt: "2027-01-11T00:00:00Z", allowedActions: ["download_certificate"],
    },
    // 발급 대기 (result published, certificate not issued yet → no download action)
    {
      id: "cert_finalist", entryId: "entry_finalist", competitionTitle: leipzigTitle, workTitle: "Harbor at Dawn",
      stage: "finalist", issuedAt: "2027-01-18T00:00:00Z", allowedActions: [],
    },
    // 재발급/교체 중 (reissuing → temporarily no download)
    {
      id: "cert_reissue", entryId: "entry_received", competitionTitle: leipzigTitle, workTitle: "Quiet Morning",
      stage: "official_selection", issuedAt: "2027-01-12T00:00:00Z", allowedActions: [],
    },
    // 다운로드 오류 (issued but generation/serve failed → retry)
    {
      id: "cert_error", entryId: "entry_sub_pending", competitionTitle: leipzigTitle, workTitle: "City Lights",
      stage: "official_selection", issuedAt: "2027-01-13T00:00:00Z", allowedActions: ["download_certificate"],
    },
  ],
  empty: [],
};

// Certificate lifecycle state. NOT part of CertificateSummary (contract gap —
// Codex to model). Mock only, keyed by certificate id, so the UI can show the
// four required states (발급 대기 / 다운로드 가능 / 재발급·교체 중 / 다운로드 오류).
export const RAW_CERT_STATE: Record<string, "issued" | "pending" | "reissuing" | "error"> = {
  cert_official: "issued",
  cert_finalist: "pending",
  cert_reissue: "reissuing",
  cert_error: "error",
};

// guardianVerification — email verification pending (dev only; no real send)
export const RAW_GUARDIAN_EMAIL_PENDING = { method: "email", status: "pending" };

/* ------------------------------------------------------------------ */
/* Payment routing options + order (MOCK; no real PG / payment window) */
/* ------------------------------------------------------------------ */

// 64-hex policy token echoed back on route selection (server pins the version).
const POLICY_TOKEN = "a1b2c3d4e5f60718".repeat(4);
const REFUND_NOTICE = {
  en: "Full refund if cancelled before the entry deadline; no refund afterwards.",
  ko: "접수 마감 전 취소 시 전액 환불, 마감 이후에는 환불 불가.",
};
const EUR70 = { amountMinor: 7000, currency: EUR };
const routeKR = { id: "toss_kr", policyToken: POLICY_TOKEN, label: { en: "Domestic card (Toss)", ko: "국내 카드 (토스)" }, mode: "test", refundNotice: REFUND_NOTICE };
const routeINTL = { id: "intl_card", policyToken: POLICY_TOKEN, label: { en: "International card", ko: "해외 카드" }, mode: "test", refundNotice: REFUND_NOTICE };

export const RAW_PAYMENT_OPTIONS = {
  // candidate(s) available + order creation allowed (still NOT a payment window)
  createReady: {
    entryId: "entry_pay", country: "KR", money: EUR70,
    routes: [routeKR, routeINTL], allowedActions: ["create_order"], blockingReasons: [],
  },
  // routes exist but the payment window isn't wired → no create_order
  paymentUnavailable: {
    entryId: "entry_pay", country: "KR", money: EUR70,
    routes: [routeKR], allowedActions: [], blockingReasons: ["PAYMENT_UNAVAILABLE"],
  },
  policyNotConfigured: {
    entryId: "entry_pay", country: "US", money: null,
    routes: [], allowedActions: [], blockingReasons: ["POLICY_NOT_CONFIGURED"],
  },
  entryLocked: {
    entryId: "entry_pay", country: "KR", money: EUR70,
    routes: [], allowedActions: [], blockingReasons: ["ENTRY_LOCKED"],
  },
  deadlinePassed: {
    entryId: "entry_pay", country: "KR", money: EUR70,
    routes: [], allowedActions: [], blockingReasons: ["DEADLINE_PASSED"],
  },
};

// Successful order creation response (pending; poll via check_payment).
export const RAW_PAYMENT_ORDER = {
  id: "order_mock_1", entryId: "entry_pay", kind: "entry_fee", money: EUR70,
  state: "pending", needsReview: false, createdAt: "2026-12-20T09:11:00Z",
  paymentClosesAtExclusive: "2026-12-31T15:00:00Z", approvalBasis: "server_verified_at",
  policyVersion: "2027.1", allowedActions: ["check_payment"], blockingReasons: ["PAYMENT_PENDING"],
};
