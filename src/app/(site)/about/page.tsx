import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { GLOBAL_STAGES } from "@/lib/site-data";
import { getServerLocale } from "@/lib/i18n/server";
import type { Bi, Locale } from "@/lib/i18n";

const PROGRAMS: { eyebrow: string; title: string; note: Bi }[] = [
  {
    eyebrow: "BOOK & ILLUSTRATION",
    title: "International Young Authors Award",
    note: {
      en: "Frankfurt Book Fair program · discovering young creators in books & illustration.",
      ko: "프랑크푸르트 도서전 연계 · 도서·일러스트 분야 청소년 창작자를 발굴합니다.",
    },
  },
  {
    eyebrow: "ART & SOCIAL IMPACT",
    title: "Art for Tomorrow Challenge",
    note: {
      en: "Seoul & international touring · spotlighting art with a social message.",
      ko: "서울 및 국제 순회전 · 사회적 메시지를 담은 미술 창작을 조명합니다.",
    },
  },
  {
    eyebrow: "MUSIC & PERFORMANCE",
    title: "Music & Performance Award",
    note: {
      en: "Spoleto Festival program · connecting music & performance to the world stage.",
      ko: "스폴레토 페스티벌 연계 · 음악·공연 분야의 무대를 국제로 잇습니다.",
    },
  },
  {
    eyebrow: "BUSINESS & TECHNOLOGY",
    title: "Young Innovators Business Challenge",
    note: {
      en: "Global showcase · presenting business & technology ideas to the world.",
      ko: "글로벌 쇼케이스 · 비즈니스·기술 아이디어를 세계에 선보입니다.",
    },
  },
];

const PARTNERS = ["La MaMa", "Partner", "Partner", "Partner", "Partner", "Partner"];

const COPY = {
  visionTitle: {
    en: "Bringing young creativity across borders to the world.",
    ko: "청소년의 창작이 국경을 넘어 세계와 만나도록.",
  },
  visionBody1: {
    en: "GYCA discovers young creators across books, art, music, and business, and connects winning works to international stages in Frankfurt, Spoleto, Seoul, and the USA.",
    ko: "GYCA는 도서·미술·음악·비즈니스 등 다양한 분야에서 청소년 창작자를 발굴하고, 수상작을 프랑크푸르트·스폴레토·서울·미국의 국제 무대로 연결합니다.",
  },
  visionBody2: {
    en: "Our mission is to help young people share their stories with the world through fair judging and a sustainable path for growth.",
    ko: "공정한 심사와 지속 가능한 성장 경로를 통해 청소년이 자신의 이야기를 세계와 나눌 수 있도록 돕는 것이 우리의 미션입니다.",
  },
  programsTitle: { en: "International program categories", ko: "국제 프로그램 카테고리" },
  programsBody: {
    en: "We run international youth competitions across four core fields.",
    ko: "네 개의 핵심 분야에서 청소년 창작자를 위한 국제 공모전을 운영합니다.",
  },
  stagesTitle: { en: "Stages that reach the world", ko: "세계로 이어지는 무대" },
  partnersTitle: { en: "Partners & institutions", ko: "파트너 · 협력기관" },
  partnersNote: {
    en: "Institution names and logos are shown within the scope of confirmed agreements.",
    ko: "협력기관 명칭·로고는 계약·승인 범위에 맞게 노출합니다.",
  },
  ctaTitle: { en: "Join GYCA now", ko: "지금 GYCA와 함께하세요" },
  ctaBody: {
    en: "Explore competitions by field and submit your work.",
    ko: "분야별 공모전을 살펴보고 작품을 접수해 보세요.",
  },
  ctaPrimary: { en: "View competitions", ko: "공모전 보기" },
  ctaSecondary: { en: "Apply", ko: "작품 접수" },
} satisfies Record<string, Bi>;

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
            ? "GYCA는 청소년의 창작을 세계 무대와 잇는 국제 청소년 창작 프로그램입니다. 분야별 공모전과 해외 본선을 통해 다음 세대의 목소리를 키웁니다."
            : "GYCA is an international youth creative program connecting young creativity to the world stage — nurturing the next generation's voice through competitions by field and overseas finals."
        }
        crumbs={[{ label: ko ? "GYCA 소개" : "About GYCA" }]}
        locale={locale}
      />

      {/* Vision / Mission */}
      <section className="mx-auto max-w-page px-6">
        <div className="grid gap-10 border-b border-line py-16 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <div className="lg:col-span-5">
            <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
              Vision &amp; Mission
            </p>
            <h2
              className={`mt-5 font-title font-bold tracking-[0.02em] text-ink-strong ${
                locale === "ko"
                  ? "text-[clamp(26px,3.4vw,40px)] leading-[1.2]"
                  : "text-[clamp(36px,5vw,60px)] leading-[1.05]"
              }`}
            >
              {COPY.visionTitle[locale]}
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-2">
            <p className="max-w-[42rem] text-[16px] leading-[1.9] text-ink-strong">
              {COPY.visionBody1[locale]}
            </p>
            <p className="mt-6 max-w-[42rem] text-[16px] leading-[1.9] text-ink-strong">
              {COPY.visionBody2[locale]}
            </p>
          </div>
        </div>
      </section>

      {/* Program categories */}
      <section className="mx-auto max-w-page px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Programs
          </p>
          <h2 className="mt-5 max-w-[36rem] font-title font-bold text-[clamp(26px,2.8vw,36px)] leading-[1.1] tracking-[0.02em] text-ink-strong">
            {COPY.programsTitle[locale]}
          </h2>
          <p className="mt-5 max-w-[42rem] text-[16px] leading-[1.9] text-ink-strong">
            {COPY.programsBody[locale]}
          </p>

          <div className="mt-12 grid gap-y-12 sm:grid-cols-2 sm:gap-x-16 lg:gap-x-24">
            {PROGRAMS.map((p) => (
              <div key={p.eyebrow} className="border-t border-line pt-6">
                <p className="text-[16px] font-bold uppercase tracking-[0.14em] text-brand-blue">
                  {p.eyebrow}
                </p>
                <h3 className="mt-3 font-title font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
                  {p.title}
                </h3>
                <p className="mt-3 text-[16px] leading-[1.9] text-ink-strong">
                  {p.note[locale]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Stages */}
      <section className="mx-auto max-w-page px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Global Stages
          </p>
          <h2 className="mt-5 font-title font-bold text-[clamp(26px,2.8vw,36px)] leading-[1.1] tracking-[0.02em] text-ink-strong">
            {COPY.stagesTitle[locale]}
          </h2>

          <div className="mt-12 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {GLOBAL_STAGES.map((s, i) => (
              <div key={s.city} className="border-t border-line pt-6">
                <p className="font-mono text-[16px] text-ink-strong">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-4 font-title font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
                  {s.city}
                </p>
                <p className="mt-3 text-[16px] leading-[1.9] text-ink-strong">
                  {s.note[locale]}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="mx-auto max-w-page px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Partners
          </p>
          <h2 className="mt-5 font-title font-bold text-[clamp(26px,2.8vw,36px)] leading-[1.1] tracking-[0.02em] text-ink-strong">
            {COPY.partnersTitle[locale]}
          </h2>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PARTNERS.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex h-24 items-center justify-center border border-line text-[16px] font-semibold text-ink-strong"
              >
                {name}
              </div>
            ))}
          </div>
          <p className="mt-6 text-[16px] text-ink-strong">{COPY.partnersNote[locale]}</p>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-page px-6">
        <div className="flex flex-col justify-between gap-8 py-16 lg:flex-row lg:items-end lg:py-24">
          <div>
            <h2 className="max-w-[26rem] font-title font-bold text-[clamp(26px,2.8vw,36px)] leading-[1.1] tracking-[0.02em] text-ink-strong">
              {COPY.ctaTitle[locale]}
            </h2>
            <p className="mt-5 max-w-[36rem] text-[16px] leading-[1.9] text-ink-strong">
              {COPY.ctaBody[locale]}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contests"
              className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] bg-black px-7 text-[14px] font-semibold text-white hover:opacity-90"
            >
              {COPY.ctaPrimary[locale]}
              <span aria-hidden>›</span>
            </Link>
            <Link
              href="/submit"
              className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white px-7 text-[14px] font-semibold text-ink hover:bg-neutral-50"
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
