import Link from "next/link";
import { notFound } from "next/navigation";
import EditorialHeader from "@/components/site/EditorialHeader";
import { getContest, CONTESTS, STATUS_LABEL, STATUS_COLOR } from "@/lib/site-data";
import { getServerLocale } from "@/lib/i18n/server";
import type { Bi, Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return CONTESTS.map((c) => ({ slug: c.slug }));
}

const SECTIONS: { id: string; title: Bi; body: Bi }[] = [
  { id: "overview", title: { en: "Overview", ko: "개요" }, body: { en: "An overview of the competition and its purpose.", ko: "공모전 개요와 취지를 안내합니다." } },
  { id: "theme", title: { en: "Theme", ko: "주제" }, body: { en: "This year's theme and creative direction.", ko: "올해의 주제와 창작 방향을 제시합니다." } },
  { id: "divisions", title: { en: "Divisions", ko: "모집 부문" }, body: { en: "The divisions and entry specifications.", ko: "세부 모집 부문과 응모 규격입니다." } },
  { id: "eligibility", title: { en: "Eligibility", ko: "참가 대상" }, body: { en: "Eligible ages and entry conditions.", ko: "참가 가능 연령·자격 조건입니다." } },
  { id: "works", title: { en: "Submissions", ko: "제출 작품" }, body: { en: "Accepted file formats and quantities.", ko: "제출 파일 형식과 수량 기준입니다." } },
  { id: "criteria", title: { en: "Judging criteria", ko: "심사 기준" }, body: { en: "Originality, understanding of the theme, expression, completion, and potential.", ko: "창의성·주제 이해·표현력·완성도·발전 가능성." } },
  { id: "awards", title: { en: "Awards & benefits", ko: "시상 및 혜택" }, body: { en: "Awards and benefits by prize tier.", ko: "수상 등급별 시상 내역과 혜택입니다." } },
  { id: "finals", title: { en: "Overseas finals", ko: "해외 본선" }, body: { en: "The overseas program for finalists.", ko: "본선 진출자의 해외 프로그램 안내입니다." } },
  { id: "notes", title: { en: "Notes", ko: "유의사항" }, body: { en: "Copyright, re-entry, and award cancellation notes.", ko: "저작권·재응모·수상 취소 등 유의사항." } },
];

const SCHEDULE: { phase: Bi; range: string }[] = [
  { phase: { en: "Entry", ko: "접수" }, range: "MAY–JUL" },
  { phase: { en: "Preliminary review", ko: "예선 심사" }, range: "AUG–SEP" },
  { phase: { en: "Overseas finals", ko: "해외 본선" }, range: "OCT–DEC" },
  { phase: { en: "Results & certificates", ko: "결과·인증" }, range: "JAN–MAR" },
];

export default async function ContestDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale: Locale = await getServerLocale();
  const c = getContest(slug);
  if (!c) notFound();

  const ko = locale === "ko";
  // leipzig-2027 has its own route, so every [slug] rendered here is a demo sample.
  const isSample = c.sample === true;
  const facts: [string, string][] = [
    [ko ? "도시" : "City", c.city],
    [ko ? "연계" : "Program", c.stage[locale]],
    [ko ? "접수 기간" : "Entry period", c.period],
    [ko ? "참가비" : "Entry fee", c.fee],
  ];

  return (
    <>
      <EditorialHeader
        eyebrow={c.categoryEn}
        title={c.title}
        description={c.summary[locale]}
        crumbs={[{ label: ko ? "공모전" : "Competitions", href: "/contests" }, { label: c.title }]}
        locale={locale}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[16px] font-semibold text-ink-strong">
            {isSample ? (
              <>{ko ? "샘플 · 준비 중" : "Sample · Coming soon"}</>
            ) : (
              <>
                <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.status]}`} />
                {STATUS_LABEL[c.status][locale]}
              </>
            )}
          </span>
        }
      />

      {isSample && (
        <div className="mx-auto max-w-page px-6 pt-6">
          <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
            {ko
              ? "이 페이지는 디자인 데모용 예시 공모이며 실제 접수를 받지 않습니다. 실제 접수는 Leipzig 2027입니다."
              : "This is a demo sample competition and does not accept entries. The real open call is Leipzig 2027."}
          </div>
        </div>
      )}

      {/* Hero image band */}
      <div className="mx-auto max-w-page px-6 pt-10 lg:pt-14">
        <div
          className="aspect-[21/9] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: `url(/images/contests/${c.slug}.jpg), ${c.tint}` }}
          role="img"
          aria-label={c.title}
        />
      </div>

      <section className="mx-auto max-w-page px-6 py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          {/* Content */}
          <div className="min-w-0">
            {/* Key facts index */}
            <dl className="border-t border-line">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-line py-4"
                >
                  <dt className="text-[16px] text-ink-strong">{k}</dt>
                  <dd className="text-[16px] font-semibold text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>

            {/* Spec sections */}
            <div className="mt-4">
              {SECTIONS.map((s) => (
                <div
                  key={s.id}
                  id={s.id}
                  className="scroll-mt-24 border-b border-line py-8"
                >
                  <h2 className="font-title font-bold text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
                    {s.title[locale]}
                  </h2>
                  <p className="mt-4 max-w-[38rem] text-[16px] leading-[1.9] text-ink-strong">
                    {s.body[locale]}
                  </p>
                </div>
              ))}
            </div>

            {/* Schedule */}
            <div id="schedule" className="scroll-mt-24 py-8">
              <h2 className="font-title font-bold text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
                {ko ? "전체 일정" : "Full schedule"}
              </h2>
              <div className="mt-6 border-t border-line">
                {SCHEDULE.map((row) => (
                  <div
                    key={row.range}
                    className="flex items-center justify-between border-b border-line py-4"
                  >
                    <span className="text-[16px] font-semibold text-ink-strong">
                      {row.phase[locale]}
                    </span>
                    <span className="text-[16px] uppercase tracking-[0.08em] text-ink-strong">
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
              <p className="text-[16px] text-ink-strong">{ko ? "참가비" : "Entry fee"}</p>
              <p className="mt-1 font-title font-bold text-[26px] text-ink-strong">
                {c.fee}
              </p>
              <p className="mt-1 text-[16px] text-ink-strong">
                {ko ? "마감" : "Deadline"} {c.deadline}
              </p>
              {isSample ? (
                <>
                  <span className="mt-5 flex cursor-not-allowed items-center justify-center rounded-lg border border-line bg-neutral-50 px-5 py-3 text-[16px] font-semibold text-ink-strong">
                    {ko ? "접수 준비 중 (예시)" : "Not open (sample)"}
                  </span>
                  <Link
                    href="/contests/leipzig-2027"
                    className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90"
                  >
                    {ko ? "실제 접수: Leipzig 2027" : "Real open call: Leipzig 2027"}
                    <span aria-hidden>›</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/submit?contest=${c.slug}`}
                    className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90"
                  >
                    {ko ? "작품 접수하기" : "Apply now"}
                    <span aria-hidden>›</span>
                  </Link>
                  <a
                    href="#"
                    className="mt-2 flex items-center justify-center rounded-lg border border-line px-5 py-3 text-[16px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
                  >
                    {ko ? "공모요강 다운로드" : "Download guidelines"}
                  </a>
                </>
              )}
              <Link
                href="/notices"
                className="mt-2 flex items-center justify-center rounded-lg px-5 py-3 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
              >
                {ko ? "문의하기" : "Contact us"}
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) — samples redirect to the real open call */}
      <div className="sticky bottom-0 z-40 border-t border-line bg-white px-6 py-3 lg:hidden">
        <Link
          href={isSample ? "/contests/leipzig-2027" : `/submit?contest=${c.slug}`}
          className="flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white"
        >
          {isSample
            ? ko
              ? "실제 접수: Leipzig 2027"
              : "Real open call: Leipzig 2027"
            : ko
              ? "작품 접수하기"
              : "Apply now"}
          <span aria-hidden>›</span>
        </Link>
      </div>
    </>
  );
}
