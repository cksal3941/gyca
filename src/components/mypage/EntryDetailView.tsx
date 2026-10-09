"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Stepper, type Tone } from "@/components/ds";
import { getEntryDetail, getCompetitionSync, getEntryAssets, listEntryUploads, listCompetitions, downloadSubmissionAsset, getGuardianStatus, requestGuardianConsent, type GuardianStatus } from "@/lib/api";
import { REQUIRED_CONSENTS } from "@/lib/content/submit-consent";
import {
  competitionTitleById,
  entryStatusView,
  entryStep,
  money,
  fmtDate,
  PAYMENT_STATE_LABEL,
} from "@/lib/entry-view";
import type { EntryDetail, EntryAction, BlockingReason, Asset } from "@/contracts";
import type { Bi, Locale } from "@/lib/i18n";

// Entry detail body (My Page → 접수 상세). CLIENT component so the contract
// adapters run in the browser with the Better Auth session (a server component
// cannot forward the session cookie to a same-origin /api/v1 call). Read-only:
// CTAs come straight from the server-provided allowedActions; this view never
// invents actions or re-decides status.

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

const GUARDIAN_STATE_LABEL: Record<string, { en: string; ko: string }> = {
  not_requested: { en: "Not requested", ko: "요청 전" },
  pending: { en: "Email sent — awaiting guardian", ko: "이메일 발송됨 — 보호자 확인 대기" },
  consented: { en: "Guardian consented — awaiting review", ko: "보호자 동의함 — 운영자 확인 대기" },
  verified: { en: "Verified", ko: "확인 완료" },
  expired: { en: "Expired — please resend", ko: "만료됨 — 재요청 필요" },
  stale: { en: "Out of date — please resend", ko: "정보 변경됨 — 재요청 필요" },
};

// Guardian consent (minor participants). Self-hides when the feature is off
// (503/NOT_CONNECTED). The email link + token are sent to the guardian's address;
// the token is never shown here. Re-request is offered when expired/stale.
function GuardianConsentPanel({ entryId, revision, guardianEmail, locale }: { entryId: string; revision: number; guardianEmail: string | null; locale: Locale }) {
  const ko = locale === "ko";
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [hidden, setHidden] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getGuardianStatus(entryId).then((r) => {
      if (!alive) return;
      if (r.kind === "success") setStatus(r.data);
      else if (r.kind === "error" && (r.code === "POLICY_NOT_CONFIGURED" || r.code === "NOT_CONNECTED")) setHidden(true);
      // other errors: leave panel with no status (request button still allows a retry)
    });
    return () => { alive = false; };
  }, [entryId, reloadKey]);

  if (hidden) return null;

  const state = status?.state ?? "not_requested";
  const canRequest = state === "not_requested" || state === "expired" || state === "stale";
  const label = GUARDIAN_STATE_LABEL[state] ?? { en: state, ko: state };

  const request = async () => {
    setBusy(true); setError(null); setNotice(null);
    const r = await requestGuardianConsent(entryId, { revision, locale: ko ? "ko" : "en" });
    setBusy(false);
    if (r.kind === "success") { setNotice(ko ? "보호자에게 확인 이메일을 보냈습니다." : "A consent email was sent to the guardian."); setReloadKey((k) => k + 1); }
    else if (r.kind === "error" && r.code === "RATE_LIMITED") setError(ko ? "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." : "Too many requests. Please try again shortly.");
    else if (r.kind === "error" && (r.code === "POLICY_NOT_CONFIGURED" || r.code === "NOT_CONNECTED")) setHidden(true);
    else setError(r.kind === "error" ? r.message : (ko ? "요청에 실패했습니다." : "Request failed."));
  };

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-6">
      <h2 className="font-title text-[17px] font-bold text-ink-strong">{ko ? "보호자 동의" : "Guardian consent"}</h2>
      <p className="mt-2 text-[16px] text-ink-strong">{ko ? "상태" : "Status"}: <b>{label[ko ? "ko" : "en"]}</b></p>
      {guardianEmail && <p className="mt-1 text-[15px] text-ink-strong/70">{ko ? "확인 이메일 수신" : "Consent email to"}: {guardianEmail}</p>}
      {notice && <Message tone="success" className="mt-3">{notice}</Message>}
      {error && <Message tone="danger" className="mt-3">{error}</Message>}
      {canRequest && (
        <button onClick={request} disabled={busy} className="mt-4 w-fit rounded-[7px] bg-black px-6 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? (ko ? "처리 중…" : "Sending…") : state === "not_requested" ? (ko ? "보호자 동의 요청" : "Request guardian consent") : (ko ? "다시 요청" : "Resend")}
        </button>
      )}
    </div>
  );
}

type Phase = "loading" | "notfound" | "error" | "ready";

export default function EntryDetailView({ id, locale }: { id: string; locale: Locale }) {
  const ko = locale === "ko";
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [compTitle, setCompTitle] = useState<Bi | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsError, setAssetsError] = useState(false);
  const [phase, setPhase] = useState<Phase>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [dlBusy, setDlBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);

  // Loading is the initial state and is re-armed by the retry handler — never set
  // synchronously in the effect body (avoids cascading renders).
  const retry = () => {
    setEntry(null);
    setAssets([]);
    setAssetsError(false);
    setPhase("loading");
    setReloadKey((k) => k + 1);
  };

  // Request a fresh 60s signed URL and open it. URLs expire and are single-use in
  // practice, so we fetch on every click (never cache/store the URL).
  const download = async (assetId: string) => {
    if (!entry) return;
    setDlBusy(assetId);
    setDlError(null);
    const r = await downloadSubmissionAsset(entry.id, assetId);
    setDlBusy(null);
    if (r.kind === "success") {
      window.open(r.data.url, "_blank", "noopener,noreferrer");
    } else {
      setDlError(
        r.kind === "error" ? r.message : ko ? "다운로드에 실패했습니다." : "Download failed.",
      );
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getEntryDetail(id);
      if (!alive) return;
      if (res.kind !== "success") {
        setPhase(res.kind === "error" && res.code !== "NOT_FOUND" && res.code !== "UNAUTHENTICATED" ? "error" : "notfound");
        return;
      }
      const e = res.data;
      // Files source depends on lifecycle: a submitted/received entry shows the
      // FROZEN submission snapshot (getEntryAssets); a draft has no snapshot yet,
      // so show its live draft files from the uploads list. Both yield Asset[].
      const isFrozen = e.entryStatus === "submitted" || e.entryStatus === "received";
      let nextAssets: Asset[] = [];
      let nextAssetsError = false;
      if (isFrozen) {
        const r = await getEntryAssets(e.id);
        if (r.kind === "success") nextAssets = r.data;
        else if (r.kind === "error") nextAssetsError = true;
      } else {
        const r = await listEntryUploads(e.id);
        if (r.kind === "success") nextAssets = [...r.data.items];
        else if (r.kind === "error") nextAssetsError = true;
      }
      // Resolve competitionId → title from the published competitions list (the
      // entry contracts only carry the id). Falls back to the mock helper / "—".
      const cl = await listCompetitions();
      if (!alive) return;
      const match = cl.kind === "success" ? cl.data.items.find((c) => c.id === e.competitionId) : undefined;
      setCompTitle(match ? match.title : null);
      setEntry(e);
      setAssets(nextAssets);
      setAssetsError(nextAssetsError);
      setPhase("ready");
    })();
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  if (phase === "loading") {
    return (
      <>
        <PageHeader
          locale={ko ? "ko" : "en"}
          eyebrow="My Page"
          title={ko ? "접수 상세" : "Entry detail"}
          crumbs={[
            { label: ko ? "마이페이지" : "My Page", href: "/mypage" },
            { label: ko ? "접수 상세" : "Entry detail" },
          ]}
        />
        <section className="mx-auto max-w-page px-6 py-12" aria-busy="true">
          <div className="h-24 animate-pulse rounded-2xl border border-line bg-surface" />
          <div className="mt-8 h-48 animate-pulse rounded-2xl border border-line bg-surface" />
          <span className="sr-only" role="status">
            {ko ? "불러오는 중" : "Loading"}
          </span>
        </section>
      </>
    );
  }

  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <>
        <PageHeader
          locale={ko ? "ko" : "en"}
          eyebrow="My Page"
          title={ko ? "접수 상세" : "Entry detail"}
          crumbs={[
            { label: ko ? "마이페이지" : "My Page", href: "/mypage" },
            { label: ko ? "접수 상세" : "Entry detail" },
          ]}
        />
        <section className="mx-auto max-w-page px-6 py-12">
          <Message
            tone={isError ? "danger" : "info"}
            title={
              isError
                ? ko ? "불러오지 못했습니다" : "Couldn't load"
                : ko ? "접수를 찾을 수 없습니다" : "Entry not found"
            }
          >
            {isError
              ? ko ? "문제가 발생했습니다. 다시 시도해 주세요." : "Something went wrong. Please try again."
              : ko ? "해당 접수가 없거나 접근 권한이 없습니다." : "This entry does not exist or you don't have access."}
          </Message>
          <div className="mt-6 flex flex-wrap gap-3">
            {isError && (
              <Button onClick={retry}>
                {ko ? "다시 시도" : "Retry"}
              </Button>
            )}
            <Button href="/mypage" variant={isError ? "outline" : "primary"}>
              {ko ? "목록으로" : "Back to My Page"}
            </Button>
          </div>
        </section>
      </>
    );
  }

  const e = entry as EntryDetail;
  const status = entryStatusView(e);
  const comp = compTitle ?? competitionTitleById(e.competitionId);
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

  const isFrozen = e.entryStatus === "submitted" || e.entryStatus === "received";
  // Consents are recorded at submit time. In the mock, a submitted/received entry
  // has the three required consents accepted; a draft does not yet.
  const consentsAccepted = e.entryStatus === "submitted" || e.entryStatus === "received";
  // Edit availability is server-driven (allowedActions), never guessed from status.
  const finals = e.finalParticipation;
  const showFinals = finals.state !== "not_available";

  return (
    <>
      <PageHeader
        locale={ko ? "ko" : "en"}
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

        {e.guardianVerification.status !== "not_required" && (
          <GuardianConsentPanel entryId={e.id} revision={e.revision} guardianEmail={e.guardian.email || null} locale={locale} />
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
            {ko ? (isFrozen ? "제출 파일" : "업로드 파일") : "Files"}
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
                    <div className="ml-auto flex items-center gap-2">
                      <StatusBadge tone={st.tone}>
                        {st.label[locale]}
                        {a.rejectionCode ? ` · ${a.rejectionCode}` : ""}
                      </StatusBadge>
                      {isFrozen && a.state === "ready" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => download(a.id)}
                          disabled={dlBusy === a.id}
                        >
                          {dlBusy === a.id
                            ? ko ? "준비 중…" : "Preparing…"
                            : ko ? "다운로드" : "Download"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {dlError && (
            <Message tone="danger" className="mt-4" title={ko ? "다운로드 오류" : "Download error"}>
              {dlError}
            </Message>
          )}
          <p className="mt-3 text-[16px] text-ink-strong">
            {ko
              ? "PDF 페이지 수·검증 결과는 서버가 확정한 값입니다. 다운로드 링크는 약 60초간 유효합니다."
              : "PDF page counts and validation are decided by the server. Download links are valid for ~60 seconds."}
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
            {e.allowedActions.includes("edit") || e.allowedActions.includes("upload")
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
