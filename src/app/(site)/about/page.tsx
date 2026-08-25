import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { GLOBAL_STAGES } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

const PROGRAMS = [
  {
    eyebrow: "BOOK & ILLUSTRATION",
    accent: "text-brand-blue",
    title: "International Young Authors Award",
    note: "프랑크푸르트 도서전 연계",
  },
  {
    eyebrow: "ART & SOCIAL IMPACT",
    accent: "text-brand-purple",
    title: "Art for Tomorrow Challenge",
    note: "서울 및 국제 순회전",
  },
  {
    eyebrow: "MUSIC & PERFORMANCE",
    accent: "text-brand-teal",
    title: "Music & Performance Award",
    note: "스폴레토 페스티벌 연계",
  },
  {
    eyebrow: "BUSINESS & TECHNOLOGY",
    accent: "text-brand-blue",
    title: "Young Innovators Business Challenge",
    note: "글로벌 쇼케이스",
  },
];

const PARTNERS = ["La MaMa", "Partner", "Partner", "Partner", "Partner", "Partner"];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About GYCA"
        title="GYCA 소개"
        description="GYCA는 청소년의 창작을 세계 무대와 잇는 국제 청소년 창작 프로그램입니다. 분야별 공모전과 해외 본선을 통해 다음 세대의 목소리를 키웁니다."
        crumbs={[{ label: "GYCA 소개" }]}
      />

      {/* 비전 / 미션 */}
      <section className="mx-auto max-w-shell px-6 py-16">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-blue">
          Vision &amp; Mission
        </p>
        <h2 className="mt-3 max-w-[46rem] font-serif text-[26px] font-bold leading-snug text-ink-strong">
          청소년의 창작이 국경을 넘어 세계와 만나도록.
        </h2>
        <p className="mt-4 max-w-[46rem] text-[15px] leading-[1.7] text-neutral-500">
          GYCA는 도서·미술·음악·비즈니스 등 다양한 분야에서 청소년 창작자를
          발굴하고, 수상작을 프랑크푸르트·스폴레토·서울·미국의 국제 무대로
          연결합니다. 공정한 심사와 지속 가능한 성장 경로를 통해 청소년이
          자신의 이야기를 세계와 나눌 수 있도록 돕는 것이 우리의 미션입니다.
        </p>
      </section>

      {/* 국제 프로그램 카테고리 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-shell px-6 py-16">
          <h2 className="font-serif text-[24px] font-bold text-ink-strong">
            국제 프로그램 카테고리
          </h2>
          <p className="mt-3 max-w-[46rem] text-[15px] leading-[1.7] text-neutral-500">
            네 개의 핵심 분야에서 청소년 창작자를 위한 국제 공모전을 운영합니다.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PROGRAMS.map((p) => (
              <div
                key={p.eyebrow}
                className="rounded-2xl border border-line bg-white p-6"
              >
                <p
                  className={`text-[11px] font-bold uppercase tracking-[0.12em] ${p.accent}`}
                >
                  {p.eyebrow}
                </p>
                <h3 className="mt-2 font-serif text-[18px] font-bold leading-snug text-ink-strong">
                  {p.title}
                </h3>
                <p className="mt-2 text-[14px] text-neutral-500">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global Stages */}
      <section className="mx-auto max-w-shell px-6 py-16">
        <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-blue">
          Global Stages
        </p>
        <h2 className="mt-3 font-serif text-[24px] font-bold text-ink-strong">
          세계로 이어지는 무대
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {GLOBAL_STAGES.map((s) => (
            <div
              key={s.city}
              className="rounded-2xl border border-line bg-white p-6"
            >
              <p className="font-serif text-[20px] font-bold text-ink-strong">
                {s.city}
              </p>
              <p className="mt-2 text-[14px] text-neutral-500">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 파트너 · 협력기관 */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-shell px-6 py-16">
          <h2 className="font-serif text-[24px] font-bold text-ink-strong">
            파트너 · 협력기관
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {PARTNERS.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex h-20 items-center justify-center rounded-2xl border border-line bg-white text-[14px] font-semibold text-neutral-500"
              >
                {name}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-neutral-500">
            협력기관 명칭·로고는 계약·승인 범위에 맞게 노출합니다.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-shell px-6 py-16">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-canvas p-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif text-[22px] font-bold text-ink-strong">
              지금 GYCA와 함께하세요
            </h2>
            <p className="mt-2 text-[15px] text-neutral-500">
              분야별 공모전을 살펴보고 작품을 접수해 보세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contests"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-3 text-[15px] font-semibold text-white hover:-translate-y-0.5"
            >
              공모전 보기
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-5 py-3 text-[15px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
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
