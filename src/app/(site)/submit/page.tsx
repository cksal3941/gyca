"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import EditorialHeader from "@/components/site/EditorialHeader";
import { Stepper, Field, TextInput, Textarea, Select, Message, StatusBadge, Button } from "@/components/ds";
import SaveBadge from "@/components/submit/SaveBadge";
import UploadField, { type UploadSpec } from "@/components/submit/UploadField";
import ConsentSection from "@/components/submit/ConsentSection";
import ScenarioBar from "@/components/submit/ScenarioBar";
import { REQUIRED_CONSENTS } from "@/lib/content/submit-consent";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getCompetitionSync, getCompetitionBySlug, type RequestState } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { useSubmitFlow, type Scenario, type UploadPurpose, type SubmitFlow } from "@/lib/mock/submit-machine";
import { useLiveSubmitFlow } from "@/lib/live/submit-flow";
import { LEIPZIG_SLUG } from "@/lib/content/leipzig-home";
import type { Competition, FormSpec } from "@/contracts";
import type { Bi, Locale } from "@/lib/i18n";

// Leipzig 2027 submit flow (MOCK; no live API). Six form steps, all driven by the
// server FormSpec, with a dev scenario switcher to reproduce every required case.
// Nothing here treats a client check as final, marks a failed save as saved, or
// treats "arrived at success" as "entry received" — the mock server decides.

const STEP_LABELS: Bi[] = [
  { en: "Participant", ko: "참가자" },
  { en: "Work", ko: "작품" },
  { en: "Files", ko: "파일" },
  { en: "Review", ko: "확인·동의" },
  { en: "Payment", ko: "결제" },
  { en: "Result", ko: "결과" },
];

const LABELS: Record<string, Bi> = {
  "participant.name": { en: "Name", ko: "이름" },
  "participant.nameEn": { en: "Name (English)", ko: "영문명" },
  "participant.dateOfBirth": { en: "Date of birth", ko: "생년월일" },
  "participant.residenceCountry": { en: "Country of residence", ko: "거주 국가" },
  "participant.nationality": { en: "Nationality", ko: "국적" },
  "participant.school": { en: "School", ko: "학교" },
  "participant.grade": { en: "Grade", ko: "학년" },
  "work.title": { en: "Work title", ko: "작품명" },
  "work.description": { en: "Work description", ko: "작품 소개" },
  "work.englishTitle": { en: "Work title (English)", ko: "영문 작품명" },
  "work.englishDescription": { en: "Work description (English)", ko: "영문 작품 소개" },
  "work.creatorBio": { en: "Creator bio", ko: "작가 소개" },
  "work.category": { en: "Category", ko: "부문" },
  "work.language": { en: "Language", ko: "언어" },
  "work.publicationStatus": { en: "Publication status", ko: "출판 여부" },
};

const money = (amountMinor: number) => `€${(amountMinor / 100).toFixed(amountMinor % 100 === 0 ? 0 : 2)}`;

function SubmitForm({
  flow,
  competition,
  formSpec,
  locale,
  showOptional,
}: {
  flow: SubmitFlow;
  competition: Competition;
  formSpec: FormSpec;
  locale: Locale;
  showOptional: boolean;
}) {
  const ko = locale === "ko";
  const { state } = flow;
  const [step, setStep] = useState(1);
  // Server confirms the entry → show the result step (never before). Derived, so
  // once `received` the UI stays on step 6 regardless of local nav.
  const uiStep = state.entryStatus === "received" ? 6 : step;

  const participantFields = formSpec.fields.filter((f) => f.path.startsWith("participant."));
  const workFields = formSpec.fields.filter((f) => f.path.startsWith("work."));
  const uploadSpecs: UploadSpec[] = formSpec.uploads.map((u) => ({
    purpose: u.purpose as UploadPurpose,
    requiredOnSubmit: u.requiredOnSubmit,
    allowedMediaTypes: [...u.allowedMediaTypes],
    maxFiles: u.maxFiles,
    maxBytes: u.maxBytes,
    minPages: u.minPages,
  }));

  const renderField = (f: FormSpec["fields"][number]) => {
    const label = LABELS[f.path]?.[locale] ?? f.path;
    const required = f.requiredOnSubmit === true;
    const value = state.values[f.path] ?? "";
    const common = { value, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => flow.setField(f.path, e.target.value) };
    return (
      <Field key={f.path} label={label} required={required}>
        {(c) => {
          if (f.inputType === "textarea") return <Textarea {...c} {...common} rows={4} />;
          if (f.inputType === "date") return <TextInput {...c} type="date" {...common} />;
          if (f.inputType === "choice" && f.path === "work.category")
            return (
              <Select {...c} {...common}>
                <option value="" disabled>{ko ? "부문 선택" : "Select a category"}</option>
                {formSpec.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label[locale]}</option>
                ))}
              </Select>
            );
          return <TextInput {...c} type={f.inputType === "email" ? "email" : "text"} {...common} />;
        }}
      </Field>
    );
  };

  // Submit gating (mirrors what the server enforces on /submit).
  const missingFields = formSpec.fields.filter((f) => f.requiredOnSubmit === true && !(state.values[f.path] ?? "").trim());
  const requiredUploads = uploadSpecs.filter((u) => u.requiredOnSubmit === true);
  const uploadsNotReady = requiredUploads.filter((u) => state.assets[u.purpose]?.state !== "ready");
  const consentsMissing = REQUIRED_CONSENTS.filter((c) => !state.consents[c.kind]);
  const canSubmit = missingFields.length === 0 && uploadsNotReady.length === 0 && consentsMissing.length === 0;

  const showOptionalConsents = showOptional; // "full version" demo (mock resume) only

  const nav = (opts: { back?: boolean; nextLabel?: string; onNext?: () => void; nextDisabled?: boolean }) => (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        {opts.back && (
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))}>
            {ko ? "이전" : "Back"}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(uiStep === 1 || uiStep === 2) && (
          <>
            <SaveBadge status={state.saveStatus} locale={locale} />
            <Button variant="outline" onClick={flow.saveDraft} disabled={state.saveStatus === "saving"}>
              {ko ? "임시저장" : "Save draft"}
            </Button>
          </>
        )}
        {opts.onNext && (
          <Button onClick={opts.onNext} disabled={opts.nextDisabled}>
            {opts.nextLabel ?? (ko ? "다음" : "Next")}
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-2xl border border-line bg-white px-6 py-5">
        <Stepper current={uiStep} steps={STEP_LABELS.map((l) => ({ label: l[locale] }))} />
      </div>

      <p className="mt-4 text-[15px] leading-[1.7] text-ink-strong">
        {isLive
          ? ko
            ? "임시저장하면 서버에 보관되어 새로고침·재로그인 후 이어서 작성할 수 있습니다. 민감한 지원서 데이터는 브라우저에 저장하지 않습니다."
            : "Saved drafts are stored on the server so you can resume after a refresh or re-login. Sensitive application data is never kept in your browser."
          : ko
            ? "현재는 데모이며 서버 저장은 아직 연결되지 않았습니다(새로고침 시 초기화됩니다). 실제 연결 후에는 임시저장으로 서버에 보관되어 새로고침·재로그인 후 이어쓸 수 있으며, 민감한 지원서 데이터는 브라우저에 저장하지 않습니다."
            : "This is a demo — server-side draft saving is not connected yet (a refresh resets it). Once connected, drafts are stored on the server so you can resume after a refresh or re-login, and sensitive application data is never kept in your browser."}
      </p>

      {state.saveStatus === "error" && (
        <Message tone="danger" className="mt-4" title={ko ? "저장 실패" : "Save failed"}>
          {state.lastError ?? (ko ? "다시 시도해 주세요." : "Please try again.")}
        </Message>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-white p-6 sm:p-8">
        {/* STEP 1 — participant + guardian */}
        {uiStep === 1 && (
          <div>
            <h2 className={`break-keep text-[22px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>
              {ko ? "참가자·보호자 정보" : "Participant & guardian"}
            </h2>
            <p className="mt-2 text-[15px] text-ink-strong">
              <span className="text-danger">*</span> {ko ? "표시는 제출 시 필수 항목입니다." : "marks fields required at submission."}
            </p>
            <div className="mt-6 grid gap-5">{participantFields.map(renderField)}</div>

            <h3 className="mt-8 text-[18px] font-bold text-ink-strong">{ko ? "보호자" : "Guardian"}</h3>
            <div className="mt-4 grid gap-5">
              <Field label={ko ? "보호자 이름" : "Guardian name"}>
                {(c) => <TextInput {...c} value={state.guardian.name} onChange={(e) => flow.setGuardian("name", e.target.value)} />}
              </Field>
              <Field label={ko ? "보호자 이메일" : "Guardian email"}>
                {(c) => <TextInput {...c} type="email" value={state.guardian.email} onChange={(e) => flow.setGuardian("email", e.target.value)} />}
              </Field>
            </div>
            <p className="mt-3 text-[15px] text-ink-strong">
              {ko
                ? "보호자 확인은 서버 정책에 따라 별도 절차로 요구될 수 있습니다(국적으로 판단하지 않음)."
                : "Guardian verification may be required by server policy as a separate step (not decided by nationality)."}
            </p>

            {nav({ onNext: () => setStep(2) })}
          </div>
        )}

        {/* STEP 2 — work */}
        {uiStep === 2 && (
          <div>
            <h2 className={`break-keep text-[22px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{ko ? "작품 정보" : "Work details"}</h2>
            <p className="mt-2 text-[15px] text-ink-strong">
              {ko ? "영문 작품명·영문 작품 소개는 필수입니다." : "English work title and description are required."}
            </p>
            <div className="mt-6 grid gap-5">{workFields.map(renderField)}</div>
            {nav({ back: true, onNext: () => setStep(3) })}
          </div>
        )}

        {/* STEP 3 — files */}
        {uiStep === 3 && (
          <div>
            <h2 className={`break-keep text-[22px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{ko ? "파일 및 필수 자료" : "Files & materials"}</h2>
            <p className="mt-2 text-[15px] text-ink-strong">
              {ko
                ? "허용 용량·페이지 수는 서버 설정값이며, 최종 검증은 서버가 수행합니다."
                : "Size and page limits come from the server; final validation is server-side."}
            </p>
            <div className="mt-6 grid gap-5">
              {uploadSpecs.map((spec) => (
                <UploadField
                  key={spec.purpose}
                  spec={spec}
                  asset={state.assets[spec.purpose]}
                  locale={locale}
                  onSelect={(file) => flow.selectFile(spec.purpose, file)}
                  onAbort={() => flow.abortUpload(spec.purpose)}
                  onRemove={() => flow.removeAsset(spec.purpose)}
                />
              ))}
            </div>
            {nav({ back: true, onNext: () => setStep(4) })}
          </div>
        )}

        {/* STEP 4 — review + consent + submit */}
        {uiStep === 4 && (
          <div>
            <h2 className={`break-keep text-[22px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{ko ? "입력 내용 확인 및 동의" : "Review & consent"}</h2>

            <dl className="mt-6 border-t border-line">
              {[
                [ko ? "공모명" : "Competition", competition.title[locale]],
                [ko ? "영문 작품명" : "Work title (EN)", state.values["work.englishTitle"] || "—"],
                [ko ? "참가자" : "Participant", state.values["participant.name"] || "—"],
                [ko ? "출품비" : "Entry fee", competition.fee ? money(competition.fee.amountMinor) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-3 text-[16px]">
                  <dt className="text-ink-strong">{k}</dt>
                  <dd className="font-semibold text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>

            {!canSubmit && (
              <Message tone="warning" className="mt-6" title={ko ? "제출 전 확인" : "Before you submit"}>
                <span className="block">
                  {missingFields.length > 0 && (ko ? `필수 입력 누락: ${missingFields.map((f) => LABELS[f.path]?.ko ?? f.path).join(", ")}. ` : `Missing fields: ${missingFields.map((f) => LABELS[f.path]?.en ?? f.path).join(", ")}. `)}
                  {uploadsNotReady.length > 0 && (ko ? "필수 파일 검증 미완료. " : "Required files not verified. ")}
                  {consentsMissing.length > 0 && (ko ? "필수 동의 미완료." : "Required consents pending.")}
                </span>
              </Message>
            )}

            <h3 className="mt-8 text-[18px] font-bold text-ink-strong">{ko ? "동의" : "Consents"}</h3>
            <div className="mt-4">
              <ConsentSection
                locale={locale}
                consents={state.consents}
                onToggle={flow.toggleConsent}
                optional={state.optionalConsents}
                onToggleOptional={flow.toggleOptional}
                showOptional={showOptionalConsents}
              />
            </div>

            {state.lastError && state.blockingReasons.includes("DEADLINE_PASSED") && (
              <Message tone="danger" className="mt-6" title={ko ? "접수 마감" : "Deadline passed"}>
                {state.lastError}
              </Message>
            )}

            {nav({
              back: true,
              nextLabel: ko ? "제출하기" : "Submit",
              nextDisabled: !canSubmit,
              onNext: () => flow.submit(),
            })}
          </div>
        )}

        {/* STEP 5 — payment */}
        {uiStep === 5 && (
          <PaymentStep flow={flow} competition={competition} locale={locale} onBack={() => setStep(4)} />
        )}

        {/* STEP 6 — result (only when server-confirmed received) */}
        {uiStep === 6 && (
          <ResultStep state={state} competition={competition} locale={locale} />
        )}
      </div>
    </>
  );
}

function PaymentStep({
  flow,
  competition,
  locale,
  onBack,
}: {
  flow: ReturnType<typeof useSubmitFlow>;
  competition: Competition;
  locale: Locale;
  onBack: () => void;
}) {
  const ko = locale === "ko";
  const { state } = flow;
  const p = state.payment;
  const fee = competition.fee ? money(competition.fee.amountMinor) : "—";

  return (
    <div>
      <h2 className={`break-keep text-[22px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{ko ? "결제" : "Payment"}</h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-[16px] text-ink-strong">{ko ? "출품비" : "Entry fee"}</span>
        <span className="text-[24px] font-extrabold text-ink-strong">{fee}</span>
      </p>
      <p className="mt-1 text-[15px] text-ink-strong">
        {ko ? "금액·통화는 서버가 제공합니다. 실제 결제창은 준비 중입니다(PG 연동 Codex 담당)." : "Amount and currency come from the server. The real payment window is not wired yet (PG is Codex's)."}
      </p>

      <div className="mt-6">
        {/* State-specific UI */}
        {(p === "none" || p === "failed" || p === "cancelled") && (
          <>
            {p === "failed" && <Message tone="danger" className="mb-4" title={ko ? "결제 실패" : "Payment failed"}>{ko ? "결제가 완료되지 않았습니다. 작품 정보와 업로드는 그대로 유지됩니다." : "Payment did not complete. Your work and uploads are preserved."}</Message>}
            {p === "cancelled" && <Message tone="warning" className="mb-4" title={ko ? "결제 취소됨" : "Payment cancelled"}>{ko ? "결제가 취소되었습니다. 다시 시도해도 입력·업로드는 유지됩니다." : "Payment was cancelled. Retrying keeps your entry and uploads."}</Message>}
            <Button onClick={flow.startPayment}>
              {p === "none" ? (ko ? "결제 진행" : "Proceed to payment") : ko ? "다시 시도" : "Retry payment"}
            </Button>
          </>
        )}

        {p === "redirecting" && <StatusBadge tone="info">{ko ? "결제창으로 이동 중…" : "Opening payment window…"}</StatusBadge>}
        {p === "checking" && <StatusBadge tone="info">{ko ? "승인 확인 중…" : "Verifying approval…"}</StatusBadge>}

        {p === "pending" && (
          <div>
            <Message tone="warning" title={ko ? "결제 대기 · 승인 지연" : "Payment pending · approval delayed"}>
              {ko ? "승인 확인에 시간이 걸리고 있습니다. 성공 URL 도착만으로 완료로 표시하지 않으며, 서버 상태를 재확인합니다." : "Approval is taking longer. Arriving at a success URL is not treated as complete; we re-check the server."}
            </Message>
            <Button className="mt-4" variant="outline" onClick={flow.refreshPayment}>{ko ? "상태 재확인" : "Re-check status"}</Button>
          </div>
        )}

        {p === "succeeded" && state.entryStatus !== "received" && (
          <div>
            <Message tone="info" title={ko ? "결제 완료 · 접수 확정 확인 중" : "Paid · confirming entry"}>
              {ko ? "결제는 확인됐지만 접수 확정을 서버에서 확인하는 중입니다. 확정되면 접수번호가 발급됩니다." : "Payment is confirmed, but the server is still confirming the entry. A receipt number is issued once confirmed."}
            </Message>
            <Button className="mt-4" variant="outline" onClick={flow.refreshPayment}>{ko ? "접수 확정 재확인" : "Re-check confirmation"}</Button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Button variant="outline" onClick={onBack}>{ko ? "이전" : "Back"}</Button>
      </div>
    </div>
  );
}

function ResultStep({
  state,
  competition,
  locale,
}: {
  state: ReturnType<typeof useSubmitFlow>["state"];
  competition: Competition;
  locale: Locale;
}) {
  const ko = locale === "ko";
  // Only render receipt details when the server confirmed the entry.
  if (state.entryStatus !== "received" || !state.receiptNumber) {
    return (
      <Message tone="info" title={ko ? "접수 확정 대기" : "Awaiting confirmation"}>
        {ko ? "서버가 접수를 확정하면 결과가 표시됩니다." : "Results appear once the server confirms your entry."}
      </Message>
    );
  }
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(ko ? "ko-KR" : "en-GB") : "—");

  return (
    <div>
      <div className="flex flex-col items-center rounded-2xl border border-line bg-canvas px-6 py-10 text-center">
        <StatusBadge tone="success">{ko ? "접수 완료" : "Entry received"}</StatusBadge>
        <h2 className={`mt-4 break-keep text-[24px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>
          {ko ? "접수가 완료되었습니다" : "Your entry is received"}
        </h2>
        <dl className="mt-8 w-full max-w-md space-y-3 text-left text-[16px]">
          {[
            [ko ? "접수번호" : "Receipt no.", state.receiptNumber],
            [ko ? "공모명" : "Competition", competition.title[locale]],
            [ko ? "작품명" : "Work title", state.values["work.englishTitle"] || "—"],
            [ko ? "결제내역" : "Payment", `${money(state.amountMinor)} · ${ko ? "결제 완료" : "paid"}`],
            [ko ? "접수 시각" : "Received at", fmt(state.receivedAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line pb-2">
              <dt className="text-ink-strong">{k}</dt>
              <dd className="font-semibold text-ink-strong">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Message tone="info" className="mt-6">
        {ko
          ? "확인 이메일 발송이 지연·실패해도 접수 자체는 완료된 상태입니다. 접수 여부는 마이페이지에서 확인하세요."
          : "Even if the confirmation email is delayed or fails, your entry is still received. Check My Page for status."}
      </Message>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button href="/mypage">{ko ? "마이페이지" : "My Page"}</Button>
        <Button href="/mypage" variant="outline">{ko ? "내 접수 보기" : "View my entries"}</Button>
      </div>
    </div>
  );
}

/** MOCK wrapper — calls the scenario-driven machine (dev preview). */
function MockSubmitInner({
  scenario,
  competition,
  formSpec,
  locale,
}: {
  scenario: Scenario;
  competition: Competition;
  formSpec: FormSpec;
  locale: Locale;
}) {
  const flow = useSubmitFlow(scenario);
  return (
    <SubmitForm
      flow={flow}
      competition={competition}
      formSpec={formSpec}
      locale={locale}
      showOptional={scenario === "resume"}
    />
  );
}

/** LIVE wrapper — calls the real-adapter flow. */
function LiveSubmitInner({
  competition,
  formSpec,
  locale,
}: {
  competition: Competition;
  formSpec: FormSpec;
  locale: Locale;
}) {
  const flow = useLiveSubmitFlow({ competition, locale });
  return (
    <SubmitForm flow={flow} competition={competition} formSpec={formSpec} locale={locale} showOptional={false} />
  );
}

/** Loads the competition (live: by slug) and mounts the live form. */
function LiveSubmit({ slug, locale }: { slug: string; locale: Locale }) {
  const ko = locale === "ko";
  const [comp, setComp] = useState<RequestState<Competition>>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    getCompetitionBySlug(slug).then((r) => {
      if (active) setComp(r);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (comp.kind === "loading") return <p className="text-[16px] text-ink-strong">{ko ? "불러오는 중…" : "Loading…"}</p>;
  if (comp.kind !== "success")
    return (
      <Message tone="danger" title={ko ? "공모 정보를 불러오지 못했습니다" : "Could not load the competition"}>
        {comp.kind === "error" ? comp.message : ""}
      </Message>
    );
  if (!comp.data.formSpec)
    return (
      <Message tone="warning" title={ko ? "접수 준비 중" : "Applications being prepared"}>
        {ko ? "접수 폼이 아직 구성되지 않았습니다." : "The entry form is not configured yet."}
      </Message>
    );
  return <LiveSubmitInner competition={comp.data} formSpec={comp.data.formSpec} locale={locale} />;
}

export default function SubmitPage() {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const [scenario, setScenario] = useState<Scenario>("happy");
  const searchParams = useSearchParams();
  const slug = searchParams.get("contest") || LEIPZIG_SLUG;

  const comp = useMemo(() => getCompetitionSync("open-ready"), []);

  return (
    <>
      <EditorialHeader
        eyebrow="Submission"
        title={ko ? "작품 접수" : "Submit your work"}
        crumbs={[
          { label: ko ? "라이프치히 2027" : "Leipzig 2027", href: "/contests/leipzig-2027" },
          { label: ko ? "작품 접수" : "Submit" },
        ]}
        locale={locale}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {isLive ? (
          <LiveSubmit slug={slug} locale={locale} />
        ) : (
          <>
            {/* Dev scenario switcher (mock only) */}
            <div className="mb-6">
              <ScenarioBar scenario={scenario} onChange={setScenario} locale={locale} />
            </div>

            {comp.kind !== "success" ? (
              <Message tone="danger" title={ko ? "공모 정보를 불러오지 못했습니다" : "Could not load the competition"}>
                {comp.kind === "error" ? comp.message : ""}
              </Message>
            ) : !comp.data.formSpec ? (
              <Message tone="warning" title={ko ? "접수 준비 중" : "Applications being prepared"}>
                {ko ? "접수 폼이 아직 구성되지 않았습니다." : "The entry form is not configured yet."}
              </Message>
            ) : (
              // Remount on scenario change so the mock flow resets cleanly.
              <MockSubmitInner
                key={scenario}
                scenario={scenario}
                competition={comp.data}
                formSpec={comp.data.formSpec}
                locale={locale}
              />
            )}
          </>
        )}
      </section>
    </>
  );
}
