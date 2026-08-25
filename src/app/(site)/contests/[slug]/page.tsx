import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
import {
  getContest,
  CONTESTS,
  STATUS_LABEL,
  STATUS_COLOR,
} from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

export function generateStaticParams() {
  return CONTESTS.map((c) => ({ slug: c.slug }));
}

const SECTIONS = [
  { id: "overview", title: "개요", body: "공모전 개요와 취지를 안내합니다." },
  { id: "theme", title: "주제", body: "올해의 주제와 창작 방향을 제시합니다." },
  { id: "divisions", title: "모집 부문", body: "세부 모집 부문과 응모 규격입니다." },
  { id: "eligibility", title: "참가 대상", body: "참가 가능 연령·자격 조건입니다." },
  { id: "works", title: "제출 작품", body: "제출 파일 형식과 수량 기준입니다." },
  { id: "criteria", title: "심사 기준", body: "창의성·주제 이해·표현력·완성도·발전 가능성." },
  { id: "awards", title: "시상 및 혜택", body: "수상 등급별 시상 내역과 혜택입니다." },
  { id: "finals", title: "해외 본선", body: "본선 진출자의 해외 프로그램 안내입니다." },
  { id: "notes", title: "유의사항", body: "저작권·재응모·수상 취소 등 유의사항." },
];

const SCHEDULE = [
  { phase: "접수", range: "MAY–JUL" },
  { phase: "예선 심사", range: "AUG–SEP" },
  { phase: "해외 본선", range: "OCT–DEC" },
  { phase: "결과·인증", range: "JAN–MAR" },
];

export default async function ContestDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = getContest(slug);
  if (!c) notFound();

  return (
    <>
      <PageHeader
        eyebrow={c.categoryEn}
        title={c.title}
        description={c.summary}
        crumbs={[{ label: "공모전", href: "/contests" }, { label: c.title }]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14px] font-semibold text-ink-strong">
            <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.status]}`} />
            {STATUS_LABEL[c.status]}
          </span>
        }
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Content */}
          <div className="min-w-0">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
              {[
                ["대표 도시", c.city],
                ["연계", c.stage],
                ["접수 기간", c.period],
                ["참가비", c.fee],
              ].map(([k, v]) => (
                <div key={k} className="bg-white p-4">
                  <dt className="text-[12px] text-neutral-500">{k}</dt>
                  <dd className="mt-1 text-[14px] font-semibold text-ink-strong">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>

            {SECTIONS.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-8">
                <h2 className="font-serif text-[22px] font-bold text-ink-strong">
                  {s.title}
                </h2>
                <p className="mt-3 text-[15px] leading-[1.7] text-neutral-500">
                  {s.body}
                </p>
              </div>
            ))}

            {/* Schedule */}
            <div id="schedule" className="scroll-mt-24 py-8">
              <h2 className="font-serif text-[22px] font-bold text-ink-strong">
                전체 일정
              </h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                {SCHEDULE.map((row, i) => (
                  <div
                    key={row.phase}
                    className={`flex items-center justify-between px-5 py-4 ${
                      i < SCHEDULE.length - 1 ? "border-b border-line" : ""
                    }`}
                  >
                    <span className="text-[15px] font-semibold text-ink-strong">
                      {row.phase}
                    </span>
                    <span className="text-[14px] text-neutral-500">
                      {row.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-2xl border border-line bg-white p-6">
              <p className="text-[13px] text-neutral-500">참가비</p>
              <p className="mt-1 font-serif text-[26px] font-bold text-ink-strong">
                {c.fee}
              </p>
              <p className="mt-1 text-[13px] text-neutral-500">
                마감 {c.deadline}
              </p>
              <Link
                href={`/submit?contest=${c.slug}`}
                className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 py-3 text-[15px] font-semibold text-white hover:-translate-y-0.5"
              >
                작품 접수하기
                <ArrowRight size={16} />
              </Link>
              <a
                href="#"
                className="mt-2 flex items-center justify-center rounded-lg border border-line px-5 py-3 text-[14px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
              >
                공모요강 다운로드
              </a>
              <Link
                href="/notices"
                className="mt-2 flex items-center justify-center rounded-lg px-5 py-3 text-[14px] font-semibold text-neutral-500 hover:text-brand-blue"
              >
                문의하기
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) */}
      <div className="sticky bottom-0 z-40 border-t border-line bg-white/95 px-6 py-3 backdrop-blur-md lg:hidden">
        <Link
          href={`/submit?contest=${c.slug}`}
          className="flex items-center justify-center gap-2 rounded-lg bg-brand-blue px-5 py-3 text-[15px] font-semibold text-white"
        >
          작품 접수하기
          <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
