import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { GLOBAL_STAGES } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

const PROGRAMS = [
  {
    eyebrow: "BOOK & ILLUSTRATION",
    accent: "text-brand-blue",
    title: "International Young Authors Award",
    note: "프랑크푸르트 도서전 연계 · 도서·일러스트 분야 청소년 창작자를 발굴합니다.",
  },
  {
    eyebrow: "ART & SOCIAL IMPACT",
    accent: "text-brand-purple",
    title: "Art for Tomorrow Challenge",
    note: "서울 및 국제 순회전 · 사회적 메시지를 담은 미술 창작을 조명합니다.",
  },
  {
    eyebrow: "MUSIC & PERFORMANCE",
    accent: "text-brand-teal",
    title: "Music & Performance Award",
    note: "스폴레토 페스티벌 연계 · 음악·공연 분야의 무대를 국제로 잇습니다.",
  },
  {
    eyebrow: "BUSINESS & TECHNOLOGY",
    accent: "text-brand-blue",
    title: "Young Innovators Business Challenge",
    note: "글로벌 쇼케이스 · 비즈니스·기술 아이디어를 세계에 선보입니다.",
  },
];

const PARTNERS = ["La MaMa", "Partner", "Partner", "Partner", "Partner", "Partner"];

export default function AboutPage() {
  return (
    <>
      <EditorialHeader
        eyebrow="About GYCA"
        title="GYCA 소개"
        description="GYCA는 청소년의 창작을 세계 무대와 잇는 국제 청소년 창작 프로그램입니다. 분야별 공모전과 해외 본선을 통해 다음 세대의 목소리를 키웁니다."
        crumbs={[{ label: "GYCA 소개" }]}
      />

      {/* 비전 / 미션 */}
      <section className="mx-auto max-w-shell px-6">
        <div className="grid gap-10 border-b border-line py-16 lg:grid-cols-12 lg:gap-16 lg:py-24">
          <div className="lg:col-span-5">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
              Vision &amp; Mission
            </p>
            <h2 className="mt-5 font-serif text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-[0.01em] text-ink-strong">
              청소년의 창작이 국경을 넘어 세계와 만나도록.
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-2">
            <p className="max-w-[42rem] text-[14px] leading-[1.9] text-neutral-500">
              GYCA는 도서·미술·음악·비즈니스 등 다양한 분야에서 청소년 창작자를
              발굴하고, 수상작을 프랑크푸르트·스폴레토·서울·미국의 국제 무대로
              연결합니다.
            </p>
            <p className="mt-6 max-w-[42rem] text-[14px] leading-[1.9] text-neutral-500">
              공정한 심사와 지속 가능한 성장 경로를 통해 청소년이 자신의 이야기를
              세계와 나눌 수 있도록 돕는 것이 우리의 미션입니다.
            </p>
          </div>
        </div>
      </section>

      {/* 국제 프로그램 카테고리 */}
      <section className="mx-auto max-w-shell px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Programs
          </p>
          <h2 className="mt-5 max-w-[36rem] font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
            국제 프로그램 카테고리
          </h2>
          <p className="mt-5 max-w-[42rem] text-[14px] leading-[1.9] text-neutral-500">
            네 개의 핵심 분야에서 청소년 창작자를 위한 국제 공모전을 운영합니다.
          </p>

          <div className="mt-12 grid gap-y-12 sm:grid-cols-2 sm:gap-x-16 lg:gap-x-24">
            {PROGRAMS.map((p) => (
              <div key={p.eyebrow} className="border-t border-line pt-6">
                <p
                  className={`text-[12px] font-bold uppercase tracking-[0.14em] ${p.accent}`}
                >
                  {p.eyebrow}
                </p>
                <h3 className="mt-3 font-serif text-[clamp(24px,2.4vw,30px)] leading-[1.2] tracking-[0.01em] text-ink-strong">
                  {p.title}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.9] text-neutral-500">
                  {p.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Stages */}
      <section className="mx-auto max-w-shell px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Global Stages
          </p>
          <h2 className="mt-5 font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
            세계로 이어지는 무대
          </h2>

          <div className="mt-12 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {GLOBAL_STAGES.map((s, i) => (
              <div key={s.city} className="border-t border-line pt-6">
                <p className="font-mono text-[13px] text-neutral-400">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <p className="mt-4 font-serif text-[clamp(24px,2.4vw,30px)] leading-[1.2] tracking-[0.01em] text-ink-strong">
                  {s.city}
                </p>
                <p className="mt-3 text-[14px] leading-[1.9] text-neutral-500">
                  {s.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 파트너 · 협력기관 */}
      <section className="mx-auto max-w-shell px-6">
        <div className="border-b border-line py-16 lg:py-24">
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Partners
          </p>
          <h2 className="mt-5 font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
            파트너 · 협력기관
          </h2>

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PARTNERS.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex h-24 items-center justify-center border border-line text-[14px] font-semibold text-neutral-400"
              >
                {name}
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-neutral-500">
            협력기관 명칭·로고는 계약·승인 범위에 맞게 노출합니다.
          </p>
        </div>
      </section>

      {/* 닫는 CTA */}
      <section className="mx-auto max-w-shell px-6">
        <div className="flex flex-col justify-between gap-8 py-16 lg:flex-row lg:items-end lg:py-24">
          <div>
            <h2 className="max-w-[26rem] font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
              지금 GYCA와 함께하세요
            </h2>
            <p className="mt-5 max-w-[36rem] text-[14px] leading-[1.9] text-neutral-500">
              분야별 공모전을 살펴보고 작품을 접수해 보세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/contests"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-6 py-3 text-[15px] font-semibold text-white hover:-translate-y-0.5"
            >
              공모전 보기
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/submit"
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink-strong hover:text-brand-blue"
            >
              작품 접수
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
