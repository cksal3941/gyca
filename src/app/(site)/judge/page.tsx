import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { ArrowRight } from "@/components/landing/icons";

const KPIS = [
  { label: "담당 공모전", value: "2" },
  { label: "배정 작품", value: "48" },
  { label: "심사 완료", value: "31" },
  { label: "남은 작품", value: "17" },
  { label: "마감일", value: "09.15" },
];

type ReviewStatus = "심사 대기" | "심사 중" | "심사 완료";

const REVIEW_STATUS_COLOR: Record<ReviewStatus, string> = {
  "심사 대기": "bg-neutral-400",
  "심사 중": "bg-brand-purple",
  "심사 완료": "bg-brand-teal",
};

type AssignedWork = {
  id: string;
  division: string;
  age: string;
  title: string;
  status: ReviewStatus;
};

const WORKS: AssignedWork[] = [
  {
    id: "A-1024",
    division: "도서·일러스트",
    age: "만 15세",
    title: "Quiet Morning",
    status: "심사 완료",
  },
  {
    id: "A-1025",
    division: "미술",
    age: "만 17세",
    title: "City of Light",
    status: "심사 중",
  },
  {
    id: "A-1026",
    division: "미술",
    age: "만 14세",
    title: "Blue Hour",
    status: "심사 대기",
  },
  {
    id: "A-1027",
    division: "도서·일러스트",
    age: "만 16세",
    title: "The Long Way",
    status: "심사 대기",
  },
];

export default function JudgeDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Judge"
        title="심사위원 대시보드"
        description="배정된 작품을 검토하고 공정하게 심사를 진행하세요."
        crumbs={[{ label: "심사위원" }]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {KPIS.map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-line bg-white p-5"
            >
              <p className="text-[13px] text-neutral-500">{k.label}</p>
              <p className="mt-2 font-serif text-[26px] font-bold text-ink-strong">
                {k.value}
              </p>
            </div>
          ))}
        </div>

        {/* Assigned works */}
        <div className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-[22px] font-bold text-ink-strong">
              배정 작품
            </h2>
          </div>
          <p className="mt-2 text-[13px] text-neutral-500">
            공정성을 위해 참가자 식별정보는 비공개입니다.
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-line bg-surface text-[13px] text-neutral-500">
                  <th className="px-5 py-3 font-semibold">접수번호</th>
                  <th className="px-5 py-3 font-semibold">부문</th>
                  <th className="px-5 py-3 font-semibold">연령</th>
                  <th className="px-5 py-3 font-semibold">작품명</th>
                  <th className="px-5 py-3 font-semibold">심사 상태</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {WORKS.map((w, i) => (
                  <tr
                    key={w.id}
                    className={i < WORKS.length - 1 ? "border-b border-line" : ""}
                  >
                    <td className="px-5 py-4 font-semibold text-ink-strong">
                      {w.id}
                    </td>
                    <td className="px-5 py-4 text-neutral-500">{w.division}</td>
                    <td className="px-5 py-4 text-neutral-500">{w.age}</td>
                    <td className="px-5 py-4 text-ink-strong">{w.title}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 text-[13px] text-neutral-500">
                        <span
                          className={`h-2 w-2 rounded-full ${REVIEW_STATUS_COLOR[w.status]}`}
                        />
                        {w.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/judge/review/${w.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:-translate-y-0.5"
                      >
                        심사하기
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
