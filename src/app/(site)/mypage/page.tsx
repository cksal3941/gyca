"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, type Tone } from "@/components/ds";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  listMyEntries,
  listMyOrders,
  listMyCertificates,
  listCompetitions,
  getEntryWorkTitle,
  getCertState,
  listPrivacyRequests,
  createPrivacyRequest,
  cancelPrivacyRequest,
  downloadCertificate,
  type RequestState,
  type ListScenario,
  type CertLifecycleState,
} from "@/lib/api";
import type { PrivacyRequest } from "@/contracts/privacy-requests";
import {
  money,
  fmtDate,
  competitionTitleById,
  entryProgressView,
  resultView,
  errorText,
  PAYMENT_STATE_LABEL,
} from "@/lib/entry-view";
import type {
  Page,
  EntrySummary,
  OrderSummary,
  CertificateSummary,
  EntryAction,
} from "@/contracts";
import { isLive } from "@/lib/api/mode";
import type { Bi, Locale } from "@/lib/i18n";

// My Page — participant dashboard. All data flows through the contract adapter
// (`src/lib/api`, MOCK): GET /entries, /orders, /certificates. This is NOT a live
// connection. Two rules the contract imposes are honoured here:
//   1. The client never invents allowed actions — every CTA is driven off the
//      server-provided `allowedActions`.
//   2. Status text is presentation derived from server facts (entryStatus,
//      reviewStatus, publishedResult, payment.state, blockingReasons) — we never
//      re-decide those facts on the client.

/* ---------------- privacy request (account closure + erasure) ---------------- */

const PRIVACY_STATE_VIEW: Record<PrivacyRequest["state"], { label: Bi; tone: Tone }> = {
  submitted: { label: { en: "Submitted", ko: "접수됨" }, tone: "info" },
  under_review: { label: { en: "Under review", ko: "검토 중" }, tone: "warning" },
  retention_hold: { label: { en: "Retention hold", ko: "보존 의무로 보류" }, tone: "warning" },
  approved_for_execution: { label: { en: "Approved for erasure", ko: "파기 승인됨" }, tone: "danger" },
  cancelled: { label: { en: "Cancelled", ko: "취소됨" }, tone: "neutral" },
};

// Account-closure + data-erasure request (live only). This opens a REQUEST that
// the operator reviews (retention holds may apply) — it is not an immediate
// deletion. The active request is the newest non-cancelled one.
function PrivacyRequestPanel({ ko }: { ko: boolean }) {
  const [items, setItems] = useState<readonly PrivacyRequest[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listPrivacyRequests().then((r) => {
      if (!alive) return;
      if (r.kind === "success") setItems(r.data.items);
      else if (r.kind === "empty") setItems([]);
      else setLoadError(true);
    });
    return () => { alive = false; };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);
  const active = (items ?? []).find((it) => it.state !== "cancelled") ?? null;

  const open = async () => {
    setBusy(true); setError(null); setNotice(null);
    const res = await createPrivacyRequest();
    setBusy(false); setConfirming(false);
    if (res.kind === "success") { setNotice(ko ? "계정 삭제·데이터 파기 요청을 접수했습니다. 검토 후 처리됩니다." : "Your account closure & erasure request was submitted for review."); reload(); }
    else setError(res.kind === "error" ? res.message : (ko ? "요청에 실패했습니다." : "Request failed."));
  };

  const cancel = async (it: PrivacyRequest) => {
    setBusy(true); setError(null); setNotice(null);
    const res = await cancelPrivacyRequest(it.id, it.revision);
    setBusy(false);
    if (res.kind === "success") { setNotice(ko ? "요청을 취소했습니다." : "Request cancelled."); reload(); }
    else setError(res.kind === "error" ? res.message : (ko ? "취소에 실패했습니다." : "Cancel failed."));
  };

  return (
    <div className="mt-6 max-w-[46rem] rounded-2xl border border-line bg-white p-6">
      <h3 className="font-title text-[18px] font-bold text-ink-strong">{ko ? "계정 삭제 · 데이터 파기 요청" : "Account closure & data erasure"}</h3>
      <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">
        {ko
          ? "계정 삭제와 개인정보 파기를 요청할 수 있습니다. 요청은 운영자 검토를 거치며, 법적·결제 보존 의무가 있는 정보는 보존 기간이 지난 뒤 파기됩니다."
          : "You can request account closure and erasure of your personal data. Requests are reviewed by the operator; data under legal or payment retention is erased once the retention period ends."}
      </p>
      {notice && <Message tone="success" className="mt-4">{notice}</Message>}
      {error && <Message tone="danger" className="mt-4" title={ko ? "오류" : "Error"}>{error}</Message>}
      {loadError && <Message tone="danger" className="mt-4">{ko ? "요청 내역을 불러오지 못했습니다." : "Could not load your requests."}</Message>}

      {items === null && !loadError && <p className="mt-4 text-[16px] text-ink-strong">{ko ? "불러오는 중…" : "Loading…"}</p>}

      {active ? (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <StatusBadge tone={PRIVACY_STATE_VIEW[active.state].tone}>{PRIVACY_STATE_VIEW[active.state].label[ko ? "ko" : "en"]}</StatusBadge>
              <span className="text-[16px] text-ink-strong">{ko ? "요청일" : "Requested"} {fmtDate(active.requestedAt, ko)}</span>
            </div>
            {active.allowedActions.includes("cancel_privacy_request") && (
              <Button size="sm" variant="outline" onClick={() => cancel(active)} disabled={busy}>{ko ? "요청 취소" : "Cancel request"}</Button>
            )}
          </div>
          {!active.allowedActions.includes("cancel_privacy_request") && (
            <p className="mt-3 text-[15px] text-ink-strong/70">{ko ? "검토가 시작된 요청은 취소할 수 없습니다." : "A request that is under review can no longer be cancelled."}</p>
          )}
        </div>
      ) : items !== null && !confirming ? (
        <Button type="button" variant="outline" className="mt-4" onClick={() => { setConfirming(true); setNotice(null); setError(null); }} disabled={busy}>
          {ko ? "계정 삭제·파기 요청하기" : "Request account closure & erasure"}
        </Button>
      ) : items !== null && confirming ? (
        <div className="mt-4 rounded-xl border border-danger/40 bg-danger/5 p-4">
          <p className="text-[16px] font-semibold text-ink-strong">{ko ? "정말 요청하시겠어요?" : "Confirm your request"}</p>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink-strong">
            {ko ? "요청 접수 후 검토가 시작되기 전까지는 취소할 수 있습니다." : "You can cancel this request until the operator starts the review."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={open} disabled={busy}>{busy ? (ko ? "처리 중…" : "Working…") : (ko ? "요청 접수" : "Submit request")}</Button>
            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={busy}>{ko ? "취소" : "Back"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Certificate download — requests a fresh short-lived signed URL on click and
// opens it. The URL is single-use and expires, so it is fetched per click and
// never stored. A failure surfaces inline; it never silently no-ops.
function CertDownloadButton({ certificateId, ko }: { certificateId: string; ko: boolean }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const go = async () => {
    setBusy(true); setFailed(false);
    const r = await downloadCertificate(certificateId);
    setBusy(false);
    if (r.kind === "success" && typeof window !== "undefined") window.open(r.data.url, "_blank", "noopener,noreferrer");
    else setFailed(true);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={go} disabled={busy}>{busy ? (ko ? "준비 중…" : "Preparing…") : (ko ? "다운로드" : "Download")}</Button>
      {failed && <span className="text-[15px] text-danger">{ko ? "다운로드에 실패했습니다. 다시 시도하세요." : "Download failed. Try again."}</span>}
    </div>
  );
}

/* ---------------- action → CTA (driven off allowedActions) ---------------- */

const ENTRY_ACTION_LABEL: Record<EntryAction, Bi> = {
  edit: { en: "Continue", ko: "이어서 작성" },
  upload: { en: "Upload files", ko: "파일 업로드" },
  submit: { en: "Submit", ko: "제출하기" },
  start_payment: { en: "Pay entry fee", ko: "결제하기" },
  check_payment: { en: "Check payment", ko: "결제 확인" },
  view_submission: { en: "View entry", ko: "접수 내용" },
  download_certificate: { en: "Certificate", ko: "인증서" },
};

const CERT_STATE_VIEW: Record<CertLifecycleState, { label: Bi; tone: Tone }> = {
  issued: { label: { en: "Download ready", ko: "다운로드 가능" }, tone: "success" },
  pending: { label: { en: "Awaiting issue", ko: "발급 대기" }, tone: "warning" },
  reissuing: { label: { en: "Reissuing", ko: "재발급·교체 중" }, tone: "info" },
  error: { label: { en: "Download error", ko: "다운로드 오류" }, tone: "danger" },
};

const CERT_STAGE_LABEL: Record<"official_selection" | "finalist", Bi> = {
  official_selection: { en: "Official Selection", ko: "Official Selection" },
  finalist: { en: "Leipzig Finalist", ko: "Leipzig Finalist" },
};

/** Destination for an entry action. Certificates open their tab (null href). */
function entryActionHref(a: EntryAction, id: string): string | null {
  switch (a) {
    case "view_submission":
      return `/mypage/entries/${id}`;
    case "check_payment":
    case "start_payment":
      return `/mypage/entries/${id}/payment`;
    case "edit":
    case "upload":
    case "submit":
      return "/submit";
    case "download_certificate":
      return null;
  }
}

/* ---------------- generic list-state renderer ---------------- */

function TabPanel({
  id,
  active,
  children,
}: {
  id: string;
  active: boolean;
  children: ReactNode;
}) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-8 flex flex-col gap-4">
      <span className="sr-only" role="status">
        {label}
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} aria-hidden className="rounded-2xl border border-line bg-white p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
          <div className="mt-3 h-5 w-2/3 animate-pulse rounded bg-neutral-200" />
          <div className="mt-3 h-4 w-28 animate-pulse rounded bg-neutral-200" />
        </div>
      ))}
    </div>
  );
}

function StateView<T>({
  state,
  locale,
  onRetry,
  empty,
  children,
}: {
  state: RequestState<T>;
  locale: Locale;
  onRetry: () => void;
  empty: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const ko = locale === "ko";
  if (state.kind === "loading") return <ListSkeleton label={ko ? "불러오는 중…" : "Loading…"} />;
  if (state.kind === "empty") return <>{empty}</>;
  if (state.kind === "error")
    return (
      <Message tone="danger" className="mt-8" title={ko ? "불러오지 못했습니다" : "Could not load"}>
        <span className="block">{errorText(state.code, state.message, locale)}</span>
        {state.retryable && (
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            {ko ? "다시 시도" : "Try again"}
          </Button>
        )}
      </Message>
    );
  return <>{children(state.data)}</>;
}

/* ---------------- tabs ---------------- */

const TABS: { id: string; label: Bi }[] = [
  { id: "entries", label: { en: "My entries", ko: "내 접수" } },
  { id: "results", label: { en: "Results", ko: "심사 결과" } },
  { id: "payments", label: { en: "Payments", ko: "결제 내역" } },
  { id: "certificates", label: { en: "Certificates", ko: "인증서" } },
  { id: "profile", label: { en: "Profile", ko: "개인정보" } },
];

/* ---------------- dev list-scenario switcher (mock only) ---------------- */

const LIST_SCENARIOS: { value: ListScenario; label: Bi }[] = [
  { value: "some", label: { en: "Populated", ko: "정상" } },
  { value: "empty", label: { en: "Empty", ko: "비어있음" } },
  { value: "error", label: { en: "Error", ko: "오류" } },
];

function ScenarioBar({
  scenario,
  onChange,
  locale,
}: {
  scenario: ListScenario;
  onChange: (s: ListScenario) => void;
  locale: Locale;
}) {
  const ko = locale === "ko";
  return (
    <div className="rounded-xl border border-dashed border-field bg-canvas px-4 py-3">
      <p className="mb-2 text-[14px] font-bold uppercase tracking-[0.12em] text-ink-strong/70">
        {ko ? "개발용 시나리오 (mock)" : "Dev scenarios (mock)"}
      </p>
      <div className="flex flex-wrap gap-2">
        {LIST_SCENARIOS.map((s) => (
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

/* ---------------- page ---------------- */

export default function MyPage() {
  const { locale } = useLocale();
  const ko = locale === "ko";

  const [tab, setTab] = useState<string>("entries");
  const [scenario, setScenario] = useState<ListScenario>("some");

  const [entries, setEntries] = useState<RequestState<Page<EntrySummary>>>({ kind: "loading" });
  const [orders, setOrders] = useState<RequestState<Page<OrderSummary>>>({ kind: "loading" });
  const [certs, setCerts] = useState<RequestState<Page<CertificateSummary>>>({ kind: "loading" });
  // competitionId → title (entry contracts carry only the id). Resolved from the
  // published competitions list; falls back to the mock helper / "—" until loaded.
  const [compMap, setCompMap] = useState<Map<string, Bi>>(new Map());

  // Guards against out-of-order responses when the scenario changes mid-flight.
  const reqId = useRef(0);

  // Kicks off the three fetches; results are applied via async `.then` callbacks
  // only (never a synchronous setState), so this is safe to call from an effect.
  const startFetch = useCallback((sc: ListScenario) => {
    const my = ++reqId.current;
    const apply =
      <T,>(set: (r: RequestState<T>) => void) =>
      (r: RequestState<T>) => {
        if (my === reqId.current) set(r);
      };
    listMyEntries(sc, { delayMs: 350 }).then(apply(setEntries));
    listMyOrders(sc, { delayMs: 350 }).then(apply(setOrders));
    listMyCertificates(sc, { delayMs: 350 }).then(apply(setCerts));
    listCompetitions().then((r) => {
      if (my === reqId.current && r.kind === "success")
        setCompMap(new Map(r.data.items.map((c) => [c.id, c.title])));
    });
  }, []);

  // Initial load only — state already starts as `loading`.
  useEffect(() => {
    startFetch(scenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loading reset lives in event handlers (allowed), not in the effect.
  const resetLoading = () => {
    setEntries({ kind: "loading" });
    setOrders({ kind: "loading" });
    setCerts({ kind: "loading" });
  };
  const changeScenario = (s: ListScenario) => {
    setScenario(s);
    resetLoading();
    startFetch(s);
  };
  const retry = () => {
    resetLoading();
    startFetch(scenario);
  };

  // Roving-tabindex keyboard nav for the tablist (Arrow/Home/End).
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    let ni: number | null = null;
    if (e.key === "ArrowRight") ni = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") ni = i === 0 ? last : i - 1;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = last;
    if (ni !== null) {
      e.preventDefault();
      setTab(TABS[ni].id);
      tabRefs.current[ni]?.focus();
    }
  };

  const emptyBlock = (text: string, cta?: ReactNode) => (
    <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
      <p className="text-[16px] text-ink-strong">{text}</p>
      {cta && <div className="mt-4 flex justify-center">{cta}</div>}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="My Page"
        title={ko ? "마이페이지" : "My Page"}
        description={
          ko
            ? "접수 현황과 심사 결과, 결제 내역, 인증서를 한곳에서 관리하세요."
            : "Track your entries, results, payments and certificates in one place."
        }
        crumbs={[{ label: ko ? "마이페이지" : "My Page" }]}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {/* Dev scenario switcher — mock mode only (hidden when connected live). */}
        {!isLive && (
          <div className="mb-6">
            <ScenarioBar scenario={scenario} onChange={changeScenario} locale={locale} />
          </div>
        )}

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={ko ? "마이페이지 섹션" : "My Page sections"}
          className="flex flex-wrap gap-2 border-b border-line pb-4"
        >
          {TABS.map((t, i) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                  active
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-line text-ink hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {t.label[locale]}
              </button>
            );
          })}
        </div>

        {/* 내 접수 */}
        <TabPanel id="entries" active={tab === "entries"}>
          <StateView
            state={entries}
            locale={locale}
            onRetry={retry}
            empty={emptyBlock(
              ko ? "아직 접수한 작품이 없습니다." : "You have not entered any works yet.",
              <Button href="/contests/leipzig-2027">{ko ? "공모 자세히 보기" : "View the contest"}</Button>,
            )}
          >
            {(page) => (
              <div className="mt-8 flex flex-col gap-4">
                {page.items.map((e) => {
                  const status = entryProgressView(e);
                  const comp = compMap.get(e.competitionId) ?? competitionTitleById(e.competitionId);
                  const workTitle = getEntryWorkTitle(e.id);
                  const resultChip =
                    e.reviewStatus === "completed" && e.publishedResult
                      ? resultView(e.publishedResult)
                      : null;
                  return (
                    <div
                      key={e.id}
                      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-bold uppercase tracking-[0.12em] text-brand-blue">
                          {e.receiptNumber ?? (ko ? "접수번호 미발급" : "No receipt yet")}
                        </p>
                        <h3 className="mt-1 font-title text-[18px] font-bold text-ink-strong">
                          {comp[locale]}
                        </h3>
                        <p className="mt-1 text-[16px] font-semibold text-ink-strong">
                          {workTitle ?? (ko ? "작품명 미입력" : "Untitled work")}
                        </p>
                        {/* 접수 상태 / 결제 상태 / 심사 결과 chips */}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusBadge tone={status.tone}>{status.label[locale]}</StatusBadge>
                          {e.payment && (
                            <StatusBadge tone={e.payment.state === "succeeded" ? "success" : "warning"}>
                              {ko ? "결제" : "Payment"}: {PAYMENT_STATE_LABEL[e.payment.state][locale]}
                            </StatusBadge>
                          )}
                          {resultChip && (
                            <StatusBadge tone={resultChip.tone}>{resultChip.label[locale]}</StatusBadge>
                          )}
                        </div>
                        <p className="mt-2 text-[16px] text-ink-strong">
                          {e.submittedAt
                            ? `${ko ? "제출" : "Submitted"} ${fmtDate(e.submittedAt, ko)}`
                            : ko
                              ? `개정 ${e.revision}회`
                              : `Revision ${e.revision}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {e.allowedActions.map((a, i) => {
                          const href = entryActionHref(a, e.id);
                          const variant = i === 0 ? "primary" : "outline";
                          return href === null ? (
                            <Button
                              key={a}
                              size="sm"
                              variant={variant}
                              onClick={() => setTab("certificates")}
                            >
                              {ENTRY_ACTION_LABEL[a][locale]}
                            </Button>
                          ) : (
                            <Button key={a} size="sm" variant={variant} href={href}>
                              {ENTRY_ACTION_LABEL[a][locale]}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </StateView>
        </TabPanel>

        {/* 심사 결과 — derived from received + review-completed entries */}
        <TabPanel id="results" active={tab === "results"}>
          <StateView
            state={entries}
            locale={locale}
            onRetry={retry}
            empty={emptyBlock(ko ? "심사 결과가 없습니다." : "No results yet.")}
          >
            {(page) => {
              // Any received entry has a result slot — either published, or "not
              // announced yet". (Whether pre-announcement data is hidden is the
              // server's job; the client only shows what it returns.)
              const received = page.items.filter((e) => e.entryStatus === "received");
              if (received.length === 0)
                return emptyBlock(ko ? "심사 결과가 없습니다." : "No results yet.");
              return (
                <div className="mt-8 flex flex-col gap-4">
                  {received.map((e) => {
                    const comp = compMap.get(e.competitionId) ?? competitionTitleById(e.competitionId);
                    const workTitle = getEntryWorkTitle(e.id);
                    const announced = e.reviewStatus === "completed";
                    const chip = announced
                      ? resultView(e.publishedResult)
                      : { label: { en: "Not announced yet", ko: "아직 발표되지 않음" }, tone: "neutral" as const };
                    // Respectful message for a non-selection outcome.
                    const notSelected = announced && e.publishedResult === "not_selected";
                    return (
                      <div
                        key={e.id}
                        className="rounded-2xl border border-line bg-white p-5"
                      >
                        <div className="flex items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-title text-[18px] font-bold text-ink-strong">
                              {comp[locale]}
                            </h3>
                            <p className="mt-1 text-[16px] text-ink-strong">
                              {workTitle ?? (ko ? "작품명 미입력" : "Untitled work")}
                            </p>
                          </div>
                          <StatusBadge tone={chip.tone}>{chip.label[locale]}</StatusBadge>
                        </div>
                        {notSelected && (
                          <p className="mt-3 text-[16px] leading-[1.6] text-ink-strong">
                            {ko
                              ? "이번 심사에서는 선정되지 않았습니다. 소중한 작품을 보내주셔서 진심으로 감사드리며, 앞으로의 창작을 응원합니다."
                              : "Your work was not selected this time. Thank you sincerely for sharing it with us — we hope you keep creating and enter again."}
                          </p>
                        )}
                        {!announced && (
                          <p className="mt-3 text-[16px] leading-[1.6] text-ink-strong">
                            {ko
                              ? "결과는 발표 일정에 맞춰 공개됩니다. 발표 전에는 결과가 표시되지 않습니다."
                              : "Results appear on the announcement schedule. Nothing is shown before then."}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            }}
          </StateView>
        </TabPanel>

        {/* 결제 내역 */}
        <TabPanel id="payments" active={tab === "payments"}>
          <StateView
            state={orders}
            locale={locale}
            onRetry={retry}
            empty={emptyBlock(ko ? "결제 내역이 없습니다." : "No payments yet.")}
          >
            {(page) => (
              <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
                <table className="w-full text-left text-[16px]">
                  <thead>
                    <tr className="border-b border-line bg-surface text-ink-strong">
                      <th className="px-5 py-3 font-semibold">{ko ? "일자" : "Date"}</th>
                      <th className="px-5 py-3 font-semibold">{ko ? "공모전" : "Contest"}</th>
                      <th className="px-5 py-3 font-semibold">{ko ? "작품" : "Work"}</th>
                      <th className="px-5 py-3 font-semibold">{ko ? "금액" : "Amount"}</th>
                      <th className="px-5 py-3 font-semibold">{ko ? "상태" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((o, i) => (
                      <tr
                        key={o.id}
                        className={i < page.items.length - 1 ? "border-b border-line" : ""}
                      >
                        <td className="px-5 py-4 text-ink-strong">{fmtDate(o.createdAt, ko)}</td>
                        <td className="px-5 py-4 font-semibold text-ink-strong">
                          {o.competitionTitle[locale]}
                        </td>
                        <td className="px-5 py-4 text-ink-strong">{o.workTitle || "—"}</td>
                        <td className="px-5 py-4 text-ink-strong">{money(o.money.amountMinor)}</td>
                        <td className="px-5 py-4 text-ink-strong">
                          {PAYMENT_STATE_LABEL[o.paymentState][locale]}
                          {o.refundSummary && (
                            <span className="ml-2 text-[14px] text-ink-strong">
                              · {ko ? "환불" : "Refund"} {money(o.refundSummary.amountMinor)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </StateView>
        </TabPanel>

        {/* 인증서 */}
        <TabPanel id="certificates" active={tab === "certificates"}>
          <StateView
            state={certs}
            locale={locale}
            onRetry={retry}
            empty={emptyBlock(ko ? "발급된 인증서가 없습니다." : "No certificates issued yet.")}
          >
            {(page) => (
              <div className="mt-8 flex flex-col gap-4">
                {page.items.map((c) => {
                  const cstate = getCertState(c.id);
                  const view = CERT_STATE_VIEW[cstate];
                  const canDownload =
                    cstate === "issued" && c.allowedActions.includes("download_certificate");
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={view.tone}>{view.label[locale]}</StatusBadge>
                          <StatusBadge tone="neutral">{CERT_STAGE_LABEL[c.stage][locale]}</StatusBadge>
                        </div>
                        <h3 className="mt-2 font-title text-[17px] font-bold text-ink-strong">
                          {c.competitionTitle[locale]}
                          {c.workTitle ? ` · ${c.workTitle}` : ""}
                        </h3>
                        <p className="mt-1 text-[16px] text-ink-strong">
                          {ko ? "선정 인증서" : "Selection certificate"} ·{" "}
                          {ko ? "발급" : "Issued"} {fmtDate(c.issuedAt, ko)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {canDownload && <CertDownloadButton certificateId={c.id} ko={ko} />}
                        {cstate === "error" && (
                          <Button size="sm" variant="outline" href="#">
                            {ko ? "다시 시도" : "Retry"}
                          </Button>
                        )}
                        {cstate === "pending" && (
                          <span className="text-[16px] text-ink-strong">
                            {ko ? "발급 준비 중" : "Being prepared"}
                          </span>
                        )}
                        {cstate === "reissuing" && (
                          <span className="text-[16px] text-ink-strong">
                            {ko ? "재발급 처리 중" : "Reissue in progress"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </StateView>
        </TabPanel>

        {/* 개인정보 — 계정 설정은 /settings(Better Auth) 재사용, 접수 인적사항은 접수 시 입력 */}
        <TabPanel id="profile" active={tab === "profile"}>
          <div className="mt-8 max-w-[46rem] rounded-2xl border border-line bg-white p-6">
            <h2 className="font-title text-[18px] font-bold text-ink-strong">{ko ? "계정 설정" : "Account settings"}</h2>
            <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">
              {ko
                ? "이름·프로필 사진·비밀번호 변경·로그인 기기·계정 삭제는 계정 설정에서 관리합니다."
                : "Manage your name, profile photo, password, signed-in devices, and account deletion in account settings."}
            </p>
            <Button href="/settings" className="mt-4">{ko ? "계정 설정 열기" : "Open account settings"}</Button>
            <p className="mt-4 border-t border-line pt-4 text-[15px] leading-[1.6] text-ink-strong/70">
              {ko
                ? "참가자 실명·영문명 등 접수용 인적사항은 계정 표시 이름과 별개이며, 각 공모 접수 단계에서 입력·수정합니다. 이미 제출한 접수의 표시값은 제출 당시 기록을 따릅니다."
                : "Entry details such as your real and English name are separate from your account name; you enter them during each competition's submission. Values on a submitted entry follow the record captured at submission."}
            </p>
          </div>

          {isLive && <PrivacyRequestPanel ko={ko} />}
        </TabPanel>
      </section>
    </>
  );
}
