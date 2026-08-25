"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
import { CONTESTS, getContest } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

const STEPS = [
  { no: "01", label: "참가자" },
  { no: "02", label: "작품" },
  { no: "03", label: "파일 업로드" },
  { no: "04", label: "확인·결제" },
  { no: "05", label: "접수 완료" },
] as const;

/** Horizontal stepper. Completed steps filled, current highlighted, future muted. */
function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-y-3">
      {STEPS.map((s, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={s.no} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-bold ${
                  active
                    ? "bg-brand-blue text-white"
                    : done
                    ? "bg-brand-blue/15 text-brand-blue"
                    : "bg-neutral-100 text-ink-strong"
                }`}
              >
                {s.no}
              </span>
              <span
                className={`text-[16px] font-medium ${
                  active
                    ? "text-ink-strong"
                    : done
                    ? "text-brand-blue"
                    : "text-ink-strong"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-3 hidden h-px w-8 sm:block lg:w-12 ${
                  done ? "bg-brand-blue" : "bg-line"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---- small styled form primitives, matching site tokens ---- */

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[16px] font-semibold text-ink-strong">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[16px] text-ink-strong">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-line px-4 py-2.5 text-[16px] text-ink-strong placeholder:text-ink-strong focus:border-brand-blue focus:outline-none";

function TextInput(props: { placeholder?: string; type?: string }) {
  return <input type={props.type ?? "text"} placeholder={props.placeholder} className={inputCls} />;
}

function Select({
  children,
  defaultValue = "",
}: {
  children: ReactNode;
  defaultValue?: string;
}) {
  return (
    <select className={`${inputCls} bg-white`} defaultValue={defaultValue}>
      {children}
    </select>
  );
}

function Textarea({ placeholder, rows = 4 }: { placeholder?: string; rows?: number }) {
  return <textarea rows={rows} placeholder={placeholder} className={inputCls} />;
}

function Dropzone({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[16px] font-semibold text-ink-strong">{label}</p>
      <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line bg-canvas px-6 py-8 text-center transition-colors hover:border-brand-blue">
        <p className="text-[16px] font-medium text-ink-strong">
          파일을 끌어다 놓거나 클릭하여 선택
        </p>
        <p className="text-[16px] text-ink-strong">{hint}</p>
        <span className="mt-2 rounded-lg border border-line px-4 py-2 text-[16px] font-semibold text-ink-strong hover:border-brand-blue">
          파일 선택
        </span>
      </div>
    </div>
  );
}

/* ---- button helpers ---- */

function PrimaryBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-3 text-[16px] font-semibold text-white hover:-translate-y-0.5"
    >
      {children}
    </button>
  );
}

function OutlineBtn({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-line px-5 py-3 text-[16px] font-semibold text-ink-strong hover:border-brand-blue"
    >
      {children}
    </button>
  );
}

/** Section card wrapper for each step. */
function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
      <h2 className="font-serif text-[22px] font-bold text-ink-strong">{title}</h2>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function SubmitFlow() {
  const searchParams = useSearchParams();
  const contestSlug = searchParams.get("contest");
  const contest = contestSlug ? getContest(contestSlug) : undefined;

  const [step, setStep] = useState(1);
  const next = () => setStep((s) => Math.min(5, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const contestTitle = contest?.title ?? "국제 청소년 공모전";

  return (
    <>
      <PageHeader
        eyebrow="Submission"
        title="작품 접수"
        description={
          contest
            ? `${contest.title} · ${contest.categoryEn} 부문 접수`
            : "참가자 정보부터 결제까지, 단계별로 작품을 접수하세요."
        }
        crumbs={[{ label: "작품 접수" }]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        {/* Stepper */}
        <div className="rounded-2xl border border-line bg-white px-6 py-5">
          <Stepper current={step} />
        </div>

        {/* UX rule note */}
        <p className="mt-4 text-[16px] leading-[1.7] text-ink-strong">
          입력 내용은 단계 이동 시 자동 저장되며, 이탈 후 재로그인해도 이어서 작성할 수 있습니다.
        </p>

        <div className="mt-8">
          {/* STEP 01 참가자 */}
          {step === 1 && (
            <StepCard title="참가자 정보">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="이름">
                  <TextInput placeholder="홍길동" />
                </Field>
                <Field label="영문명">
                  <TextInput placeholder="Gildong Hong" />
                </Field>
                <Field label="생년월일">
                  <TextInput type="date" />
                </Field>
                <Field label="학교">
                  <TextInput placeholder="OO중학교 / OO고등학교" />
                </Field>
                <Field label="학년">
                  <Select>
                    <option value="" disabled>
                      학년 선택
                    </option>
                    <option>초등</option>
                    <option>중1</option>
                    <option>중2</option>
                    <option>중3</option>
                    <option>고1</option>
                    <option>고2</option>
                    <option>고3</option>
                  </Select>
                </Field>
                <Field label="국가">
                  <Select>
                    <option value="" disabled>
                      국가 선택
                    </option>
                    <option>대한민국</option>
                    <option>United States</option>
                    <option>Japan</option>
                    <option>기타</option>
                  </Select>
                </Field>
                <Field label="보호자" hint="미성년자는 보호자 정보가 필요합니다.">
                  <TextInput placeholder="보호자 이름 / 연락처" />
                </Field>
              </div>

              <label className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-canvas p-4">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-blue" />
                <span className="text-[16px] leading-[1.6] text-ink-strong">
                  개인정보 수집·이용 및 참가 약관에 동의합니다. (필수)
                </span>
              </label>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                <OutlineBtn>임시저장</OutlineBtn>
                <PrimaryBtn onClick={next}>
                  다음 <ArrowRight size={16} />
                </PrimaryBtn>
              </div>
            </StepCard>
          )}

          {/* STEP 02 작품 */}
          {step === 2 && (
            <StepCard title="작품 정보">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="공모전">
                  <Select defaultValue={contest?.title ?? ""}>
                    <option value="" disabled>
                      공모전 선택
                    </option>
                    {CONTESTS.map((c) => (
                      <option key={c.slug} value={c.title}>
                        {c.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="부문">
                  <Select>
                    <option value="" disabled>
                      부문 선택
                    </option>
                    <option>도서·일러스트</option>
                    <option>미술</option>
                    <option>음악·공연</option>
                    <option>UX·기술</option>
                    <option>비즈니스</option>
                  </Select>
                </Field>
                <Field label="제목">
                  <TextInput placeholder="작품 제목" />
                </Field>
                <Field label="영문제목">
                  <TextInput placeholder="Work Title" />
                </Field>
              </div>

              <div className="mt-5 grid gap-5">
                <Field label="설명">
                  <Textarea placeholder="작품에 대한 설명을 입력하세요." />
                </Field>
                <Field label="제작의도">
                  <Textarea placeholder="작품을 제작하게 된 의도와 메시지를 입력하세요." />
                </Field>
              </div>

              <fieldset className="mt-6">
                <legend className="mb-2 text-[16px] font-semibold text-ink-strong">
                  참가 형태
                </legend>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-[16px] text-ink-strong hover:border-brand-blue">
                    <input type="radio" name="teamType" defaultChecked className="h-4 w-4 accent-brand-blue" />
                    개인
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-[16px] text-ink-strong hover:border-brand-blue">
                    <input type="radio" name="teamType" className="h-4 w-4 accent-brand-blue" />
                    팀
                  </label>
                </div>
              </fieldset>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                <OutlineBtn onClick={prev}>이전</OutlineBtn>
                <OutlineBtn>임시저장</OutlineBtn>
                <PrimaryBtn onClick={next}>
                  다음 <ArrowRight size={16} />
                </PrimaryBtn>
              </div>
            </StepCard>
          )}

          {/* STEP 03 파일 업로드 */}
          {step === 3 && (
            <StepCard title="파일 업로드">
              <div className="grid gap-6 sm:grid-cols-2">
                <Dropzone label="이미지" hint="JPG, PNG · 최대 20MB · 최대 10장" />
                <Dropzone label="PDF" hint="PDF · 최대 50MB" />
                <Dropzone label="음원" hint="MP3, WAV · 최대 50MB" />
                <Dropzone label="포트폴리오" hint="PDF, ZIP · 최대 100MB" />
              </div>

              <div className="mt-6">
                <Field label="영상 링크" hint="YouTube 또는 Vimeo 링크를 입력하세요.">
                  <TextInput placeholder="https://youtube.com/..." />
                </Field>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                <OutlineBtn onClick={prev}>이전</OutlineBtn>
                <OutlineBtn>업로드</OutlineBtn>
                <PrimaryBtn onClick={next}>
                  다음 <ArrowRight size={16} />
                </PrimaryBtn>
              </div>
            </StepCard>
          )}

          {/* STEP 04 확인·결제 */}
          {step === 4 && (
            <StepCard title="확인 및 결제">
              <div className="rounded-2xl border border-line bg-canvas p-5">
                <p className="text-[16px] font-bold uppercase tracking-[0.12em] text-brand-blue">
                  Review
                </p>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-[16px] sm:grid-cols-2">
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">공모전</dt>
                    <dd className="font-medium text-ink-strong">{contestTitle}</dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">부문</dt>
                    <dd className="font-medium text-ink-strong">
                      {contest?.categoryEn ?? "미선택"}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">참가자</dt>
                    <dd className="font-medium text-ink-strong">홍길동</dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">작품명</dt>
                    <dd className="font-medium text-ink-strong">Quiet Morning</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-[16px] font-semibold text-ink-strong">참가비</p>
                  <p className="mt-2 font-serif text-[26px] font-bold text-ink-strong">
                    {contest?.fee ?? "₩60,000"}
                  </p>
                  <p className="mt-1 text-[16px] text-ink-strong">
                    카드 · 계좌이체 · 간편결제 지원
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5">
                  <p className="text-[16px] font-semibold text-ink-strong">환불규정</p>
                  <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">
                    접수 마감 전 취소 시 전액 환불되며, 마감 이후에는 환불이 불가합니다.
                    심사 시작 이후 접수 취소는 불가합니다.
                  </p>
                </div>
              </div>

              <label className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-canvas p-4">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-blue" />
                <span className="text-[16px] leading-[1.6] text-ink-strong">
                  접수 내용과 환불규정을 확인하였으며, 최종 제출에 동의합니다. (필수)
                </span>
              </label>

              <div className="mt-8 flex flex-wrap items-center justify-end gap-3">
                <OutlineBtn onClick={prev}>수정</OutlineBtn>
                <PrimaryBtn onClick={next}>
                  결제하고 완료 <ArrowRight size={16} />
                </PrimaryBtn>
              </div>
            </StepCard>
          )}

          {/* STEP 05 접수 완료 */}
          {step === 5 && (
            <StepCard title="접수 완료">
              <div className="flex flex-col items-center rounded-2xl border border-line bg-canvas px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue/15 text-[26px] text-brand-blue">
                  ✓
                </span>
                <h3 className="mt-4 font-serif text-[24px] font-bold text-ink-strong">
                  접수가 완료되었습니다
                </h3>
                <p className="mt-2 text-[16px] text-ink-strong">
                  접수 확인 메일을 발송했습니다. 마이페이지에서 진행 상황을 확인하세요.
                </p>

                <dl className="mt-8 w-full max-w-md space-y-3 text-left text-[16px]">
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">접수번호</dt>
                    <dd className="font-semibold text-brand-blue">GYCA-2026-000123</dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">작품명</dt>
                    <dd className="font-medium text-ink-strong">Quiet Morning</dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">결제정보</dt>
                    <dd className="font-medium text-ink-strong">
                      {contest?.fee ?? "₩60,000"} · 카드 결제 완료
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-line pb-2">
                    <dt className="text-ink-strong">결과발표일</dt>
                    <dd className="font-medium text-ink-strong">2026.09.15</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <OutlineBtn>접수증</OutlineBtn>
                <Link
                  href="/mypage"
                  className="rounded-lg border border-line px-5 py-3 text-[16px] font-semibold text-ink-strong hover:border-brand-blue"
                >
                  내 접수
                </Link>
                <PrimaryBtn onClick={() => setStep(1)}>추가 접수</PrimaryBtn>
              </div>
            </StepCard>
          )}
        </div>
      </section>
    </>
  );
}

function SubmitFallback() {
  return (
    <>
      <PageHeader
        eyebrow="Submission"
        title="작품 접수"
        crumbs={[{ label: "작품 접수" }]}
      />
      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="rounded-2xl border border-line bg-white px-6 py-5">
          <Stepper current={1} />
        </div>
      </section>
    </>
  );
}

export default function SubmitPage() {
  return (
    <Suspense fallback={<SubmitFallback />}>
      <SubmitFlow />
    </Suspense>
  );
}
