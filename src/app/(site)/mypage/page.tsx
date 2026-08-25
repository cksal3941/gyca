"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { ArrowRight } from "@/components/landing/icons";

/** 참가자 접수 상태 흐름: 임시저장 → 접수완료 → 심사중 → 본선진출 → 최종수상 */
type SubStatus =
  | "임시저장"
  | "접수완료"
  | "심사중"
  | "본선진출"
  | "최종수상";

const SUB_STATUS_COLOR: Record<SubStatus, string> = {
  임시저장: "bg-neutral-400",
  접수완료: "bg-brand-teal",
  심사중: "bg-brand-purple",
  본선진출: "bg-brand-blue",
  최종수상: "bg-amber-500",
};

type SubmissionAction = { label: string; href: string; primary?: boolean };

function statusActions(status: SubStatus): SubmissionAction[] {
  switch (status) {
    case "임시저장":
      return [
        { label: "계속 작성", href: "/submit", primary: true },
        { label: "삭제", href: "#" },
      ];
    case "접수완료":
      return [
        { label: "접수 확인", href: "#", primary: true },
        { label: "접수증", href: "#" },
      ];
    case "심사중":
      return [{ label: "접수 확인", href: "#", primary: true }];
    case "본선진출":
      return [
        { label: "결과 확인", href: "#", primary: true },
        { label: "해외 본선 신청", href: "#" },
      ];
    case "최종수상":
      return [
        { label: "인증서", href: "#", primary: true },
        { label: "수상작 보기", href: "/winners" },
      ];
  }
}

type Submission = {
  id: string;
  work: string;
  contest: string;
  status: SubStatus;
};

const SUBMISSIONS: Submission[] = [
  {
    id: "A-1042",
    work: "Quiet Morning",
    contest: "International Young Authors Award",
    status: "심사중",
  },
  {
    id: "A-1043",
    work: "City of Light",
    contest: "Art for Tomorrow Challenge",
    status: "본선진출",
  },
  {
    id: "A-1044",
    work: "미완성 스케치",
    contest: "Music & Performance Award",
    status: "임시저장",
  },
];

type PaymentRow = {
  date: string;
  contest: string;
  amount: string;
  status: "결제완료" | "환불" | "대기";
};

const PAYMENTS: PaymentRow[] = [
  {
    date: "2026.05.12",
    contest: "International Young Authors Award",
    amount: "₩60,000",
    status: "결제완료",
  },
  {
    date: "2026.03.20",
    contest: "Art for Tomorrow Challenge",
    amount: "₩50,000",
    status: "결제완료",
  },
  {
    date: "2026.02.28",
    contest: "Music & Performance Award",
    amount: "₩70,000",
    status: "대기",
  },
];

type JudgingResult = {
  work: string;
  contest: string;
  award: "Gold" | "Silver" | "Finalist";
};

const AWARD_BADGE: Record<JudgingResult["award"], string> = {
  Gold: "bg-amber-500",
  Silver: "bg-neutral-400",
  Finalist: "bg-brand-teal",
};

const RESULTS: JudgingResult[] = [
  {
    work: "City of Light",
    contest: "Art for Tomorrow Challenge",
    award: "Gold",
  },
  {
    work: "Quiet Morning",
    contest: "International Young Authors Award",
    award: "Finalist",
  },
];

const CERTIFICATES = [
  { title: "Art for Tomorrow Challenge · Gold", date: "2026.09.30" },
  { title: "IYAC 본선 진출 인증서", date: "2026.09.20" },
];

const TABS = ["내 접수", "심사 결과", "결제 내역", "인증서", "개인정보"] as const;
type Tab = (typeof TABS)[number];

function ActionButton({ action }: { action: SubmissionAction }) {
  return (
    <Link
      href={action.href}
      className={
        action.primary
          ? "inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[16px] font-semibold text-white hover:-translate-y-0.5"
          : "inline-flex items-center rounded-lg border border-line px-4 py-2 text-[16px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
      }
    >
      {action.label}
      {action.primary && <ArrowRight size={14} />}
    </Link>
  );
}

export default function MyPage() {
  const [tab, setTab] = useState<Tab>("내 접수");

  return (
    <>
      <PageHeader
        eyebrow="My Page"
        title="마이페이지"
        description="접수 현황과 심사 결과, 결제 내역, 인증서를 한곳에서 관리하세요."
        crumbs={[{ label: "마이페이지" }]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-line pb-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                tab === t
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-line text-ink hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 내 접수 */}
        {tab === "내 접수" && (
          <div className="mt-8 flex flex-col gap-4">
            {SUBMISSIONS.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold uppercase tracking-[0.12em] text-brand-blue">
                    {s.id}
                  </p>
                  <h3 className="mt-1 font-serif text-[18px] font-bold text-ink-strong">
                    {s.work}
                  </h3>
                  <p className="mt-1 text-[16px] text-ink-strong">{s.contest}</p>
                  <p className="mt-2 flex items-center gap-2 text-[16px] text-ink-strong">
                    <span
                      className={`h-2 w-2 rounded-full ${SUB_STATUS_COLOR[s.status]}`}
                    />
                    {s.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {statusActions(s.status).map((a) => (
                    <ActionButton key={a.label} action={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 심사 결과 */}
        {tab === "심사 결과" && (
          <div className="mt-8 flex flex-col gap-4">
            {RESULTS.map((r) => (
              <div
                key={r.work}
                className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-[18px] font-bold text-ink-strong">
                    {r.work}
                  </h3>
                  <p className="mt-1 text-[16px] text-ink-strong">{r.contest}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[16px] font-semibold text-white ${AWARD_BADGE[r.award]}`}
                >
                  {r.award}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 결제 내역 */}
        {tab === "결제 내역" && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-[16px]">
              <thead>
                <tr className="border-b border-line bg-surface text-[16px] text-ink-strong">
                  <th className="px-5 py-3 font-semibold">일자</th>
                  <th className="px-5 py-3 font-semibold">공모전</th>
                  <th className="px-5 py-3 font-semibold">금액</th>
                  <th className="px-5 py-3 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {PAYMENTS.map((p, i) => (
                  <tr
                    key={p.date + p.contest}
                    className={i < PAYMENTS.length - 1 ? "border-b border-line" : ""}
                  >
                    <td className="px-5 py-4 text-ink-strong">{p.date}</td>
                    <td className="px-5 py-4 font-semibold text-ink-strong">
                      {p.contest}
                    </td>
                    <td className="px-5 py-4 text-ink-strong">{p.amount}</td>
                    <td className="px-5 py-4 text-ink-strong">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 인증서 */}
        {tab === "인증서" && (
          <div className="mt-8 flex flex-col gap-4">
            {CERTIFICATES.map((c) => (
              <div
                key={c.title}
                className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-[17px] font-bold text-ink-strong">
                    {c.title}
                  </h3>
                  <p className="mt-1 text-[16px] text-ink-strong">발급 {c.date}</p>
                </div>
                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[16px] font-semibold text-white hover:-translate-y-0.5"
                >
                  다운로드
                  <ArrowRight size={14} />
                </a>
              </div>
            ))}
          </div>
        )}

        {/* 개인정보 */}
        {tab === "개인정보" && (
          <form className="mt-8 max-w-[46rem] rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-col gap-5">
              {[
                { label: "이름", type: "text", placeholder: "홍길동" },
                {
                  label: "이메일",
                  type: "email",
                  placeholder: "you@example.com",
                },
                {
                  label: "연락처",
                  type: "tel",
                  placeholder: "010-0000-0000",
                },
                {
                  label: "비밀번호 변경",
                  type: "password",
                  placeholder: "새 비밀번호",
                },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="text-[16px] font-semibold text-ink-strong">
                    {f.label}
                  </span>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    className="mt-2 w-full rounded-lg border border-line bg-canvas px-4 py-3 text-[16px] text-ink-strong outline-none focus:border-brand-blue"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-3 text-[16px] font-semibold text-white hover:-translate-y-0.5"
            >
              변경 사항 저장
              <ArrowRight size={16} />
            </button>
          </form>
        )}
      </section>
    </>
  );
}
