import Link from "next/link";
import { BookOpen, Palette, Music, Laptop, Briefcase, type LucideIcon } from "lucide-react";
import EditorialHeader from "@/components/site/EditorialHeader";
import { getServerLocale } from "@/lib/i18n/server";
import { unsplashCover } from "@/lib/unsplash";
import type { Bi, Locale } from "@/lib/i18n";

// Mission-first About page (not a corporate profile): the mission, the fields
// you can enter, how judging works, and a call to action. Field and process
// facts mirror the real competition data in site-data.ts.

// The five entry fields — labels match CONTEST_FILTERS / CATEGORY_LABEL. The
// descriptors just restate what each field covers (no invented claims).
const FIELDS: { Icon: LucideIcon; name: Bi; note: Bi }[] = [
  { Icon: BookOpen, name: { en: "Book & Illustration", ko: "도서·일러스트" }, note: { en: "Picture books, illustration, comics", ko: "그림책·삽화·만화" } },
  { Icon: Palette, name: { en: "Art", ko: "미술" }, note: { en: "Painting, drawing, digital art", ko: "회화·드로잉·디지털 아트" } },
  { Icon: Music, name: { en: "Music & Performance", ko: "음악·공연" }, note: { en: "Playing, singing, stage performance", ko: "연주·성악·무대 공연" } },
  { Icon: Laptop, name: { en: "UX & Tech", ko: "UX·기술" }, note: { en: "Design, apps, technical projects", ko: "디자인·앱·기술 프로젝트" } },
  { Icon: Briefcase, name: { en: "Business", ko: "비즈니스" }, note: { en: "Ideas, planning, entrepreneurship", ko: "아이디어·기획·창업" } },
];

// Three-step flow — a plain restatement of how the competition runs, consistent
// with the mission copy (submit → expert judging on public criteria → results & stage).
const PROCESS: { step: string; title: Bi; note: Bi }[] = [
  { step: "01", title: { en: "Submit", ko: "접수" }, note: { en: "Enter your work and details online — no membership required.", ko: "온라인으로 작품과 정보를 제출합니다. 별도 회원 가입은 필요 없습니다." } },
  { step: "02", title: { en: "Judging", ko: "심사" }, note: { en: "Field experts evaluate every entry against clear, published criteria.", ko: "각 분야 전문가가 공개된 기준에 따라 모든 접수작을 심사합니다." } },
  { step: "03", title: { en: "Results & stage", ko: "발표·무대" }, note: { en: "Winners are announced and presented on real exhibition and performance stages.", ko: "수상작을 발표하고 실제 전시·공연 무대에서 소개합니다." } },
];

const COPY = {
  visionTitle: {
    en: "An international competition built on fair judging and real stages.",
    ko: "공정한 심사와 실제 무대로 운영되는 국제 공모전입니다.",
  },
  visionBody: {
    en: "GYCA is about more than winning a prize. Depending on the competition, that experience can reach beyond borders — connecting young creators internationally and taking them abroad together to exhibit their work and take part in non-profit activities. And because every entry is judged fairly by field experts against clear, published criteria, what we want to leave behind isn't a certificate, but the real experience of meeting the world through your own work.",
    ko: "GYCA는 상을 겨루는 데서 멈추지 않습니다. 공모전에 따라 그 경험은 국경 너머로 이어져, 청소년 창작자들이 국제적으로 연결되고 함께 해외로 나가 작품을 전시하거나 비영리 활동에 참여하기도 합니다. 모든 접수작을 각 분야 전문가가 공개된 기준으로 공정하게 심사하기에, 우리가 남기려는 것은 상장 한 장이 아니라 자신의 작업으로 세상과 마주하는 실제 경험입니다.",
  },
  fieldsTitle: { en: "Fields you can enter", ko: "당신이 참여할 수 있는 분야" },
  fieldsBody: {
    en: "From picture books to business ideas — find the field that fits your work.",
    ko: "그림책부터 비즈니스 아이디어까지, 당신의 작업에 맞는 분야를 찾으세요.",
  },
  processTitle: { en: "How it works", ko: "참여 방법" },
  ctaTitle: { en: "See what's open now", ko: "지금 접수 중인 공모전 보기" },
  ctaBody: {
    en: "Browse the current competitions, check the criteria, and submit when you're ready.",
    ko: "진행 중인 공모전과 심사 기준을 확인하고, 준비되면 작품을 접수하세요.",
  },
  ctaPrimary: { en: "View competitions", ko: "공모전 보기" },
  ctaSecondary: { en: "Apply", ko: "작품 접수" },
} satisfies Record<string, Bi>;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] font-bold uppercase tracking-[0.18em] text-brand-blue">{children}</p>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 break-keep font-title font-bold text-[clamp(26px,2.8vw,36px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
      {children}
    </h2>
  );
}

export default async function AboutPage() {
  const locale: Locale = await getServerLocale();
  const ko = locale === "ko";

  return (
    <>
      <EditorialHeader
        eyebrow="About GYCA"
        title={ko ? "GYCA 소개" : "About GYCA"}
        description={
          ko
            ? "청소년 창작자를 위한 국제 공모전."
            : "An international competition for young creators."
        }
        crumbs={[{ label: ko ? "GYCA 소개" : "About GYCA" }]}
        locale={locale}
      />

      {/* Vision + stats — full-height, text only (mission line stays on one line) */}
      <section className="flex min-h-screen items-center">
        <div className="mx-auto w-full max-w-page px-6 py-28 lg:py-40">
          <SectionLabel>Vision &amp; Mission</SectionLabel>
          <h2
            className={`mt-8 break-keep font-title font-bold tracking-[0.02em] text-ink-strong lg:whitespace-nowrap ${
              ko ? "text-[clamp(24px,3vw,34px)] leading-[1.3]" : "text-[clamp(30px,4vw,46px)] leading-[1.1]"
            }`}
          >
            {COPY.visionTitle[locale]}
          </h2>
          <p className="mt-12 text-[18px] leading-[1.9] text-ink-strong">{COPY.visionBody[locale]}</p>
          <div
            className="mt-16 aspect-[16/5] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
            style={{ backgroundImage: `url(${unsplashCover("about-vision", 1600)})` }}
            role="img"
            aria-label={ko ? "청소년 창작자들의 전시 현장" : "Young creators at an exhibition"}
          />
        </div>
      </section>

      {/* Fields — full-height, ICONS (no numbering) */}
      <section className="flex min-h-screen items-center bg-surface">
        <div className="mx-auto w-full max-w-page px-6 py-28 lg:py-40">
          <SectionLabel>Fields</SectionLabel>
          <SectionTitle>{COPY.fieldsTitle[locale]}</SectionTitle>
          <p className="mt-5 max-w-[40rem] text-[16px] leading-[1.8] text-ink-strong">{COPY.fieldsBody[locale]}</p>
          <ul className="mt-20 grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <li key={f.name.en} className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
                  <f.Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[20px] font-bold leading-[1.2] text-ink-strong">{f.name[locale]}</p>
                  <p className="mt-1.5 text-[16px] leading-[1.6] text-ink-strong">{f.note[locale]}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works — full-height, IMAGE + numbered steps (numbers are meaningful here) */}
      <section className="flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-page items-center gap-12 px-6 py-28 lg:grid-cols-2 lg:gap-20 lg:py-40">
          <div
            className="aspect-[3/2] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5 lg:order-first"
            style={{ backgroundImage: `url(${unsplashCover("about-process", 1000)})` }}
            role="img"
            aria-label={ko ? "심사 및 전시 현장" : "Judging and exhibition"}
          />
          <div>
            <SectionLabel>Process</SectionLabel>
            <SectionTitle>{COPY.processTitle[locale]}</SectionTitle>
            <ol className="mt-14 space-y-12">
              {PROCESS.map((p) => (
                <li key={p.step} className="flex gap-5">
                  <span className="font-display text-[28px] font-extrabold leading-none text-brand-blue">{p.step}</span>
                  <div>
                    <h3 className="text-[20px] font-bold text-ink-strong">{p.title[locale]}</h3>
                    <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">{p.note[locale]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Closing CTA — compact band (NOT full-height), full-bleed IMAGE background.
          -mb-16 cancels the shared <main> pb-16 so this band sits flush on the footer. */}
      <section className="relative -mb-16 flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${unsplashCover("about-cta", 1600)})` }}
          role="img"
          aria-label=""
        />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative mx-auto w-full max-w-page px-6 py-20 text-white lg:py-24">
          <p className="text-[14px] font-bold uppercase tracking-[0.18em] text-white/80">Apply</p>
          <h2 className="mt-4 break-keep font-title font-bold text-[clamp(26px,3.2vw,40px)] leading-[1.15] tracking-[0.02em] text-white">
            {COPY.ctaTitle[locale]}
          </h2>
          <p className="mt-5 max-w-[40rem] text-[17px] leading-[1.8] text-white/90">{COPY.ctaBody[locale]}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/contests"
              className="flex h-12 items-center justify-center gap-[10px] rounded-[7px] bg-white px-8 text-[15px] font-semibold text-ink-strong hover:opacity-90"
            >
              {COPY.ctaPrimary[locale]}
              <span aria-hidden>›</span>
            </Link>
            <Link
              href="/submit"
              className="flex h-12 items-center justify-center gap-[10px] rounded-[7px] border border-white/70 px-8 text-[15px] font-semibold text-white hover:bg-white/10"
            >
              {COPY.ctaSecondary[locale]}
              <span aria-hidden>›</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
