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
  type RequestState,
  type ListScenario,
  type CertLifecycleState,
} from "@/lib/api";
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
                        {canDownload && (
                          <Button size="sm" href="#">
                            {ko ? "다운로드" : "Download"}
                          </Button>
                        )}
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

        {/* 개인정보 (static preview; no profile contract yet — not wired) */}
        <TabPanel id="profile" active={tab === "profile"}>
          <Message
            tone="info"
            className="mt-8 max-w-[46rem]"
            title={ko ? "준비 중" : "Coming soon"}
          >
            {ko
              ? "개인정보 편집은 아직 서버에 연결되지 않았습니다. 아래는 미리보기이며, 저장은 연결 후 제공됩니다."
              : "Profile editing isn't connected to the server yet. The form below is a preview; saving will be available once it's wired."}
          </Message>
          <form className="mt-4 max-w-[46rem] rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-col gap-5">
              {[
                { label: ko ? "이름" : "Name", type: "text", placeholder: ko ? "홍길동" : "Jane Doe" },
                { label: ko ? "이메일" : "Email", type: "email", placeholder: "you@example.com" },
                { label: ko ? "연락처" : "Phone", type: "tel", placeholder: "010-0000-0000" },
                {
                  label: ko ? "비밀번호 변경" : "Change password",
                  type: "password",
                  placeholder: ko ? "새 비밀번호" : "New password",
                },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="text-[16px] font-semibold text-ink-strong">{f.label}</span>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    disabled
                    className="mt-2 w-full rounded-lg border border-field bg-surface px-4 py-3 text-[16px] text-ink-strong outline-none focus:border-brand-blue disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </label>
              ))}
            </div>
            <Button type="button" className="mt-6" disabled>
              {ko ? "변경 사항 저장" : "Save changes"}
            </Button>
          </form>
        </TabPanel>
      </section>
    </>
  );
}
