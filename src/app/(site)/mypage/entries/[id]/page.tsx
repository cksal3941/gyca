import { notFound } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Stepper, type Tone } from "@/components/ds";
import { getEntryDetail, getCompetitionSync, getEntryAssets } from "@/lib/api";
import { getServerLocale } from "@/lib/i18n/server";
import { REQUIRED_CONSENTS } from "@/lib/content/submit-consent";
import {
  competitionTitleById,
  entryStatusView,
  entryStep,
  money,
  fmtDate,
  PAYMENT_STATE_LABEL,
} from "@/lib/entry-view";
import type { EntryDetail, EntryAction, BlockingReason } from "@/contracts";
import type { Bi, Locale } from "@/lib/i18n";

// Entry detail (My Page → 접수 상세). Read-only server render off the contract
// adapter (MOCK). CTAs come straight from the server-provided allowedActions;
// this page never invents actions or re-decides status.

const STEP_LABELS: Bi[] = [
  { en: "Submit", ko: "제출" },
  { en: "Payment", ko: "결제" },
  { en: "Confirmed", ko: "접수 확정" },
  { en: "Review", ko: "심사" },
  { en: "Result", ko: "결과" },
];

// Guidance shown for a blocking reason (only the participant-facing ones).
const BLOCKING_GUIDANCE: Partial<Record<BlockingReason, Bi>> = {
  REQUIRED_FIELDS_MISSING: {
    en: "Some required fields are still missing.",
    ko: "필수 입력 항목이 아직 남아 있습니다.",
  },
  CONSENT_REQUIRED: {
    en: "Required consents are not complete.",
    ko: "필수 동의가 완료되지 않았습니다.",
  },
  GUARDIAN_VERIFICATION_REQUIRED: {
    en: "Guardian verification is required.",
    ko: "보호자 확인이 필요합니다.",
  },
  FILE_NOT_READY: {
    en: "A required file has not passed validation yet.",
    ko: "필수 파일 검증이 아직 완료되지 않았습니다.",
  },
  PAYMENT_PENDING: {
    en: "Payment is being confirmed.",
    ko: "결제 확인이 진행 중입니다.",
  },
  RECEIPT_PENDING: {
    en: "Payment is done; the entry is being confirmed on the server.",
    ko: "결제는 완료됐고, 서버에서 접수 확정을 확인하는 중입니다.",
  },
  PAYMENT_REQUIRED: {
    en: "Payment is required to complete your entry.",
    ko: "접수 완료를 위해 결제가 필요합니다.",
  },
  DEADLINE_PASSED: {
    en: "The entry deadline has passed.",
    ko: "접수 마감이 지났습니다.",
  },
};

const ENTRY_ACTION_LABEL: Record<EntryAction, Bi> = {
  edit: { en: "Continue editing", ko: "이어서 작성" },
  upload: { en: "Upload files", ko: "파일 업로드" },
  submit: { en: "Submit", ko: "제출하기" },
  start_payment: { en: "Pay entry fee", ko: "결제하기" },
  check_payment: { en: "Check payment", ko: "결제 확인" },
  view_submission: { en: "View entry", ko: "접수 내용" },
  download_certificate: { en: "Certificate", ko: "인증서" },
};

const GUARDIAN_LABEL: Record<string, Bi> = {
  verified: { en: "Verified", ko: "확인 완료" },
  required: { en: "Required", ko: "확인 필요" },
  pending: { en: "Pending", ko: "확인 대기" },
  failed: { en: "Failed", ko: "확인 실패" },
  expired: { en: "Expired", ko: "만료됨" },
};

const ASSET_PURPOSE_LABEL: Record<string, Bi> = {
  cover_image: { en: "Cover image", ko: "표지 이미지" },
  book_pdf: { en: "Book PDF", ko: "도서 PDF" },
  copyright_declaration: { en: "Copyright declaration", ko: "저작권 확인서" },
  guardian_consent: { en: "Guardian consent", ko: "보호자 동의서" },
  publisher_permission: { en: "Publisher permission", ko: "출판 허가서" },
};

const ASSET_STATE_VIEW: Record<string, { label: Bi; tone: Tone }> = {
  pending_upload: { label: { en: "Pending", ko: "대기" }, tone: "neutral" },
  uploaded: { label: { en: "Uploaded", ko: "업로드 완료" }, tone: "info" },
  validating: { label: { en: "Validating", ko: "검증 중" }, tone: "info" },
  ready: { label: { en: "Ready", ko: "검증 완료" }, tone: "success" },
  rejected: { label: { en: "Rejected", ko: "검증 실패" }, tone: "danger" },
};

const FINALS_STATE_LABEL: Record<string, Bi> = {
  invited: { en: "Invited", ko: "초청됨" },
  confirmation_pending: { en: "Confirmation pending", ko: "확정 대기" },
  confirmed: { en: "Confirmed", ko: "확정됨" },
  declined: { en: "Declined", ko: "불참" },
  not_available: { en: "—", ko: "—" },
};

const fmtBytes = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`;

// FormSpec category id → localized label (from the mock competition policy).
function categoryLabel(id: string, locale: Locale): string {
  const c = getCompetitionSync("open-ready");
  if (c.kind === "success" && c.data.formSpec) {
    const found = c.data.formSpec.categories.find((x) => x.id === id);
    if (found) return found.label[locale];
  }
  return id || "—";
}

function actionHref(a: EntryAction, id: string): string | null {
  switch (a) {
    case "view_submission":
      return null; // we are already on the detail page
    case "check_payment":
    case "start_payment":
      return `/mypage/entries/${id}/payment`;
    case "download_certificate":
      return "/mypage";
    case "edit":
    case "upload":
    case "submit":
      return "/submit";
  }
}

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const ko = locale === "ko";

  const res = await getEntryDetail(id);
  if (res.kind !== "success") notFound();
  const e: EntryDetail = res.data;

  const status = entryStatusView(e);
  const comp = competitionTitleById(e.competitionId);
  const guardianVisible = e.guardianVerification.status !== "not_required";

  const rows: [string, string][] = [
    [ko ? "공모명" : "Competition", comp[locale]],
    [ko ? "접수번호" : "Receipt no.", e.receiptNumber ?? (ko ? "미발급" : "Not issued")],
    [ko ? "제출일" : "Submitted", fmtDate(e.submittedAt, ko)],
    [ko ? "접수 확정일" : "Confirmed", fmtDate(e.receivedAt, ko)],
    [ko ? "개정" : "Revision", String(e.revision)],
  ];
  if (e.payment)
    rows.push([
      ko ? "결제" : "Payment",
      `${money(e.payment.amountMinor)} · ${PAYMENT_STATE_LABEL[e.payment.state][locale]}`,
    ]);
  if (guardianVisible)
    rows.push([
      ko ? "보호자 확인" : "Guardian",
      (GUARDIAN_LABEL[e.guardianVerification.status] ?? { en: "—", ko: "—" })[locale],
    ]);

  const guidance = e.blockingReasons
    .map((r) => BLOCKING_GUIDANCE[r]?.[locale])
    .filter((x): x is string => Boolean(x));

  const descLabel = ko ? "영문 소개" : "Description (EN)";
  const submissionRows: [string, string][] = [
    [ko ? "영문 작품명" : "Work title (EN)", e.work.englishTitle || "—"],
    [descLabel, e.work.englishDescription || "—"],
    [ko ? "부문" : "Category", e.work.category ? categoryLabel(e.work.category, locale) : "—"],
    [ko ? "참가자" : "Participant", e.participant.name || "—"],
    [ko ? "생년월일" : "Date of birth", e.participant.dateOfBirth ?? "—"],
    [
      ko ? "보호자" : "Guardian",
      [e.guardian.name, e.guardian.email].filter(Boolean).join(" · ") || "—",
    ],
  ];

  const assetsRes = await getEntryAssets(e.id);
  const assets = assetsRes.kind === "success" ? assetsRes.data : [];
  const assetsError = assetsRes.kind === "error";
  // Consents are recorded at submit time. In the mock, a submitted/received entry
  // has the three required consents accepted; a draft does not yet.
  const consentsAccepted = e.entryStatus === "submitted" || e.entryStatus === "received";
  // Edit availability is server-driven (allowedActions), never guessed from status.
  const canEdit = e.allowedActions.includes("edit") || e.allowedActions.includes("upload");
  const finals = e.finalParticipation;
  const showFinals = finals.state !== "not_available";

  return (
    <>
      <PageHeader
        eyebrow="My Page"
        title={e.receiptNumber ?? (ko ? "접수 상세" : "Entry detail")}
        crumbs={[
          { label: ko ? "마이페이지" : "My Page", href: "/mypage" },
          { label: ko ? "접수 상세" : "Entry detail" },
        ]}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {/* Status tracker */}
        <div className="rounded-2xl border border-line bg-white px-6 py-5">
          <Stepper current={entryStep(e)} steps={STEP_LABELS.map((l) => ({ label: l[locale] }))} />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <StatusBadge tone={status.tone}>{status.label[locale]}</StatusBadge>
          <span className="text-[16px] text-ink-strong">{comp[locale]}</span>
        </div>

        {guidance.length > 0 && (
          <Message tone="info" className="mt-6" title={ko ? "다음 단계 안내" : "What's next"}>
            <span className="block">{guidance.join(" ")}</span>
          </Message>
        )}

        {/* Summary */}
        <dl className="mt-8 rounded-2xl border border-line bg-white p-6">
          {rows.map(([k, v], i) => (
            <div
              key={k}
              className={`flex justify-between gap-4 py-3 text-[16px] ${
                i < rows.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <dt className="text-ink-strong">{k}</dt>
              <dd className="font-semibold text-ink-strong">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Submission content (participant / work / guardian) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">
            {ko ? "제출 내용" : "Submission"}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {submissionRows.map(([k, v]) => (
              <div key={k} className={k === descLabel ? "sm:col-span-2" : ""}>
                <dt className="text-[16px] text-ink-strong">{k}</dt>
                <dd className="mt-1 text-[16px] font-semibold text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Uploaded files (Assets — separate contract, server-validated states) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">
            {ko ? "제출 파일" : "Files"}
          </h2>
          {assetsError ? (
            <p className="mt-3 text-[16px] text-ink-strong">
              {ko ? "파일 목록을 불러오지 못했습니다." : "Couldn't load the file list."}
            </p>
          ) : assets.length === 0 ? (
            <p className="mt-3 text-[16px] text-ink-strong">
              {ko ? "업로드된 파일이 없습니다." : "No files uploaded yet."}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {assets.map((a) => {
                const st = ASSET_STATE_VIEW[a.state] ?? { label: { en: a.state, ko: a.state }, tone: "neutral" as Tone };
                return (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line p-4"
                  >
                    <span className="text-[16px] font-semibold text-ink-strong">
                      {ASSET_PURPOSE_LABEL[a.purpose]?.[locale] ?? a.purpose}
                    </span>
                    <span className="text-[16px] text-ink-strong">
                      {a.displayName} · {fmtBytes(a.sizeBytes)}
                      {a.pageCount != null ? ` · ${a.pageCount}${ko ? "쪽" : "pp"}` : ""}
                    </span>
                    <StatusBadge tone={st.tone} className="ml-auto">
                      {st.label[locale]}
                      {a.rejectionCode ? ` · ${a.rejectionCode}` : ""}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[16px] text-ink-strong">
            {ko
              ? "PDF 페이지 수·검증 결과는 서버가 확정한 값입니다."
              : "PDF page counts and validation are decided by the server."}
          </p>
        </div>

        {/* Consent history (three required consents recorded at submit) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">
            {ko ? "동의 내역" : "Consents"}
          </h2>
          <ul className="mt-4 flex flex-col gap-2">
            {REQUIRED_CONSENTS.map((c) => (
              <li
                key={c.kind}
                className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <span className="text-[16px] text-ink-strong">
                  {c.title[locale]} · v{c.version}
                </span>
                <StatusBadge tone={consentsAccepted ? "success" : "neutral"}>
                  {consentsAccepted ? (ko ? "동의함" : "Accepted") : ko ? "미동의" : "Pending"}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[16px] text-ink-strong">
            {ko
              ? "보호자 확인은 동의 체크가 아닌 별도 절차로 관리됩니다."
              : "Guardian verification is a separate step, not a consent checkbox."}
          </p>
        </div>

        {/* Editing availability + receipt link (both server-driven) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">
            {ko ? "수정 및 영수증" : "Editing & receipt"}
          </h2>
          <p className="mt-3 text-[16px] leading-[1.6] text-ink-strong">
            {canEdit
              ? ko
                ? "이 접수는 아직 수정할 수 있습니다."
                : "This entry can still be edited."
              : ko
                ? "제출 후에는 접수 내용을 수정할 수 없습니다. 수정·다운로드 가능 여부는 서버 정책을 따릅니다."
                : "After submission the entry cannot be edited. What you can edit or download follows server policy."}
          </p>
          {e.payment?.orderId && (
            <Button className="mt-4" size="sm" variant="outline" href={`/mypage/entries/${id}/payment`}>
              {ko ? "영수증·결제 보기" : "View payment & receipt"}
            </Button>
          )}
        </div>

        {/* Finals (본선) — display-only; no real €1,100 payment until requested */}
        {showFinals && (
          <div className="mt-8 rounded-2xl border border-info/25 bg-info-soft p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">{ko ? "본선 안내" : "Finals"}</StatusBadge>
              <StatusBadge tone="neutral">{FINALS_STATE_LABEL[finals.state][locale]}</StatusBadge>
            </div>
            <h2 className="mt-3 font-title text-[18px] font-bold text-ink-strong">
              {ko ? "라이프치히 본선 참가 안내" : "Leipzig finals participation"}
            </h2>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">
              {ko
                ? "본선 진출자로 초청되었습니다. 참가 확정 및 지원 안내는 별도로 제공됩니다."
                : "You have been invited to the finals. Confirmation and support details follow separately."}
            </p>
            <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">
              {ko
                ? "본선 참가비 €1,100 및 수상별 지원 금액은 표시용 안내이며, 실제 결제는 별도 요청 시 제공됩니다."
                : "The €1,100 finals fee and award-based support are shown for information only; real payment is added on separate request."}
            </p>
            <Button className="mt-4" variant="outline" disabled>
              {ko ? "참가 확정 (준비 중)" : "Confirm participation (coming soon)"}
            </Button>
          </div>
        )}

        {/* CTAs (from server allowedActions) */}
        <div className="mt-8 flex flex-wrap gap-3">
          {e.allowedActions
            .filter((a) => a !== "view_submission")
            .map((a, i) => {
              const href = actionHref(a, e.id);
              if (href === null) return null;
              return (
                <Button key={a} href={href} variant={i === 0 ? "primary" : "outline"}>
                  {ENTRY_ACTION_LABEL[a][locale]}
                </Button>
              );
            })}
          <Button href="/mypage" variant="ghost">
            {ko ? "목록으로" : "Back to My Page"}
          </Button>
        </div>
      </section>
    </>
  );
}
