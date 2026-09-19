"use client";

import { useState } from "react";
import {
  Button,
  SectionTitle,
  ArrowLink,
  Message,
  StatusBadge,
  Field,
  TextInput,
  Select,
  Textarea,
  Tabs,
  Stepper,
  Modal,
  PaymentRouting,
} from "@/components/ds";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { PaymentOptionsScenario } from "@/lib/api";

/* Internal reference page — a living style guide for the site design system.
   Not linked in the public nav. Verify at /styleguide. */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-12">
      <SectionTitle title={title} />
      <div className="mt-8">{children}</div>
    </section>
  );
}

const COLORS = [
  ["bg-brand-blue", "brand-blue"],
  ["bg-brand-orange", "brand-orange"],
  ["bg-ink-strong", "ink-strong"],
  ["bg-ink", "ink"],
  ["bg-canvas", "canvas"],
  ["bg-surface", "surface"],
  ["bg-success", "success"],
  ["bg-info", "info"],
  ["bg-warning", "warning"],
  ["bg-danger", "danger"],
];

const PO_SCENARIOS: { value: PaymentOptionsScenario; label: string }[] = [
  { value: "createReady", label: "create_order" },
  { value: "paymentUnavailable", label: "PAYMENT_UNAVAILABLE" },
  { value: "policyNotConfigured", label: "POLICY_NOT_CONFIGURED" },
  { value: "entryLocked", label: "ENTRY_LOCKED" },
  { value: "deadlinePassed", label: "DEADLINE_PASSED" },
];

export default function StyleGuidePage() {
  const { locale } = useLocale();
  const [modal, setModal] = useState(false);
  const [po, setPo] = useState<PaymentOptionsScenario>("createReady");
  const [email, setEmail] = useState("");
  const emailError = email.length > 0 && !email.includes("@") ? "유효한 이메일을 입력하세요." : undefined;

  return (
    <div className="mx-auto max-w-page px-6 py-16">
      <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
        Design System
      </p>
      <h1 className="mt-3 font-title text-[clamp(36px,5vw,60px)] font-bold tracking-[0.02em] text-ink-strong">
        GYCA Style Guide
      </h1>
      <p className="mt-4 max-w-[42rem] text-[16px] leading-[1.8] text-ink-strong">
        공통 UI와 디자인 기준(내부 참고용). 토큰은 <code>globals.css @theme</code> 단일 소스를
        사용하며, 화면에서 색·간격을 하드코딩하지 않습니다.
      </p>

      {/* Colors */}
      <Block title="Colors">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {COLORS.map(([bg, name]) => (
            <div key={name}>
              <div className={`h-16 w-full rounded-lg ring-1 ring-black/5 ${bg}`} />
              <p className="mt-2 text-[16px] text-ink-strong">{name}</p>
            </div>
          ))}
        </div>
      </Block>

      {/* Typography */}
      <Block title="Typography (KR / EN)">
        <div className="space-y-4">
          <p className="font-display text-[48px] uppercase leading-none text-ink-strong">
            Display · YOUR BOOK
          </p>
          <p className="font-title text-[36px] font-bold text-ink-strong">
            Title 제목 · Art Book Awards
          </p>
          <p className="text-[16px] leading-[1.8] text-ink-strong">
            Body 본문 · 표지 포함 20쪽 이상 단일 PDF로 출품합니다. Submit one PDF of 20+ pages.
          </p>
        </div>
      </Block>

      {/* Spacing & width */}
      <Block title="Spacing & Max-width">
        <ul className="space-y-2 text-[16px] text-ink-strong">
          <li>섹션 폭: <code>max-w-page</code> (1400px · 헤더·히어로 제외 공통) · 좁은 본문: <code>max-w-content</code> (1000px)</li>
          <li>가로 여백: <code>px-6</code> · 섹션 세로: <code>py-16 ~ py-24</code></li>
          <li>간격은 Tailwind 4px 스케일(gap/space)만 사용 — 임의 픽셀 지양</li>
        </ul>
      </Block>

      {/* Buttons & links */}
      <Block title="Buttons & Links">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 max-w-[240px]">
          {/* Long text wraps instead of breaking the layout */}
          <Button variant="outline">
            A very long button label that must wrap without breaking the layout
          </Button>
        </div>
        <div className="mt-6">
          <ArrowLink href="/contests">공모전 보기 · View competitions</ArrowLink>
        </div>
      </Block>

      {/* Form fields */}
      <Block title="Inputs & Fields">
        <div className="grid max-w-[46rem] gap-5 sm:grid-cols-2">
          <Field label="이름" required help="여권 영문명과 동일하게 입력하세요.">
            {(f) => <TextInput {...f} placeholder="Gildong Hong" />}
          </Field>
          <Field label="이메일" error={emailError}>
            {(f) => (
              <TextInput
                {...f}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            )}
          </Field>
          <Field label="부문">
            {(f) => (
              <Select {...f} defaultValue="">
                <option value="" disabled>
                  선택
                </option>
                <option>Picture Book</option>
                <option>Art Book</option>
              </Select>
            )}
          </Field>
          <Field label="작품 소개" className="sm:col-span-2">
            {(f) => <Textarea {...f} placeholder="영문 작품 소개" />}
          </Field>
        </div>
      </Block>

      {/* Messages */}
      <Block title="Messages">
        <div className="grid max-w-[46rem] gap-3">
          <Message tone="info" title="안내">표지 포함 20쪽 이상 단일 PDF로 제출하세요.</Message>
          <Message tone="success" title="접수 완료">결제가 확인되어 접수가 완료되었습니다.</Message>
          <Message tone="warning" title="결제 확인 중">결제 승인을 확인하는 중입니다.</Message>
          <Message tone="danger" title="오류">PDF 페이지 수가 부족합니다 (최소 20쪽).</Message>
        </div>
      </Block>

      {/* Status badges (not color-only) */}
      <Block title="Status Badges">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="success">접수 중 · Open</StatusBadge>
          <StatusBadge tone="neutral">접수 예정 · Upcoming</StatusBadge>
          <StatusBadge tone="info">심사 중 · In review</StatusBadge>
          <StatusBadge tone="neutral">종료 · Closed</StatusBadge>
          <StatusBadge tone="warning">결제 대기 · Pending</StatusBadge>
          <StatusBadge tone="danger">결제 실패 · Failed</StatusBadge>
          <StatusBadge tone="success">Official Selection</StatusBadge>
        </div>
        <p className="mt-3 text-[16px] text-ink-strong">
          상태는 색이 아니라 <strong>라벨(+점)</strong>로 구분합니다.
        </p>
      </Block>

      {/* Tabs */}
      <Block title="Tabs">
        <Tabs
          tabs={[
            { value: "entries", label: "내 접수", content: <p className="text-[16px] text-ink-strong">접수 목록이 표시됩니다.</p> },
            { value: "results", label: "심사 결과", content: <p className="text-[16px] text-ink-strong">결과가 표시됩니다.</p> },
            { value: "certs", label: "인증서", content: <p className="text-[16px] text-ink-strong">인증서 목록이 표시됩니다.</p> },
          ]}
        />
      </Block>

      {/* Stepper */}
      <Block title="Stepper">
        <Stepper
          current={3}
          steps={[
            { label: "참가자" },
            { label: "작품" },
            { label: "업로드" },
            { label: "결제" },
            { label: "완료" },
          ]}
        />
      </Block>

      {/* Modal */}
      <Block title="Modal">
        <Button variant="outline" onClick={() => setModal(true)}>
          모달 열기
        </Button>
        <Modal
          open={modal}
          onClose={() => setModal(false)}
          title="접수 확정 안내"
          description="결제 성공 후 서버 확인이 끝나면 접수번호가 발급됩니다."
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setModal(false)}>
                닫기
              </Button>
              <Button size="sm" onClick={() => setModal(false)}>
                확인
              </Button>
            </>
          }
        >
          모달은 포커스 트랩·Esc 닫기·배경 클릭 닫기를 지원합니다.
        </Modal>
      </Block>

      {/* Payment routing (mock) — scenario preview */}
      <Block title="Payment routing (mock)">
        <div className="flex flex-wrap gap-2">
          {PO_SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => setPo(s.value)}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                po === s.value
                  ? "border-black bg-black text-white"
                  : "border-line text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-6 max-w-[46rem] rounded-2xl border border-line p-6">
          <PaymentRouting key={po} locale={locale} scenario={po} />
        </div>
        <p className="mt-3 text-[16px] text-ink-strong">
          mock 전용 · 실결제/결제창 없음. 상태별 안내·차단 메시지를 미리봅니다.
        </p>
      </Block>

      {/* Representative home section */}
      <Block title="Sample · Home hero section">
        <div className="grid items-center gap-8 rounded-2xl bg-canvas p-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <StatusBadge tone="success">OPEN CALL · 14 SEP – 31 DEC 2026</StatusBadge>
            <h3 className="mt-4 font-display text-[clamp(32px,4vw,56px)] uppercase leading-[0.98] text-ink-strong">
              Your book. Your story. Next stop, Leipzig.
            </h3>
            <p className="mt-4 max-w-[32rem] text-[16px] leading-[1.7] text-ink-strong">
              전 세계 만 7–18세를 위한 국제 아트북 공모.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button href="/submit">Apply Now</Button>
              <Button href="/contests" variant="outline">
                View Competition
              </Button>
            </div>
          </div>
          <div
            className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-cover bg-center ring-1 ring-black/5"
            style={{ backgroundImage: "url(/images/hero/iyac.jpg), linear-gradient(135deg,#0b05e2,#111)" }}
            role="img"
            aria-label="Sample"
          />
        </div>
      </Block>

      {/* Representative submit form segment */}
      <Block title="Sample · Submit form segment">
        <div className="max-w-[46rem] rounded-2xl border border-line bg-white p-6 sm:p-8">
          <Stepper current={1} steps={[{ label: "참가자" }, { label: "작품" }, { label: "업로드" }, { label: "결제" }, { label: "완료" }]} />
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <Field label="영문명" required>
              {(f) => <TextInput {...f} placeholder="Gildong Hong" />}
            </Field>
            <Field label="생년월일" required help="만 7–18세만 참가할 수 있습니다.">
              {(f) => <TextInput {...f} type="date" />}
            </Field>
          </div>
          <Message tone="info" className="mt-6">
            미성년자는 보호자 정보와 동의가 필요합니다.
          </Message>
          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <Button variant="outline">임시저장</Button>
            <Button>다음</Button>
          </div>
        </div>
      </Block>
    </div>
  );
}
