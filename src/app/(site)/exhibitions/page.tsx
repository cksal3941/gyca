"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  EXHIBITIONS,
  EXHIBITION_FILTERS,
  CITY_LABEL,
  EXHIBITION_TYPE_LABEL,
  type Exhibition,
} from "@/lib/site-data";
import type { Locale } from "@/lib/i18n";
import { isLive } from "@/lib/api/mode";
import ProjectCollectionView from "@/components/archive/ProjectCollectionView";

function ExhibitionRow({ e, flip, locale }: { e: Exhibition; flip: boolean; locale: Locale }) {
  return (
    <article className="grid items-center gap-8 border-b border-line py-14 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div className={flip ? "lg:order-2" : ""}>
        <span className="inline-flex items-center gap-2">
          <span className="bg-brand-blue px-[15px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
            {EXHIBITION_TYPE_LABEL[e.type][locale]}
          </span>
          <span className="border border-line px-[13px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-ink-strong">
            {locale === "ko" ? "예시 · 준비 중" : "Sample · Coming soon"}
          </span>
        </span>
        <Link href={`/exhibitions/${e.slug}`}>
          <h2 className="mt-5 font-title text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.15] tracking-[0.02em] text-ink-strong hover:text-brand-blue">
            {e.title[locale]}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.8] text-ink-strong">
          {e.summary[locale]}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] text-ink-strong">
          <span>{CITY_LABEL[e.city][locale]}</span>
          <span>{e.date}</span>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/exhibitions/${e.slug}`}
            className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] bg-black px-7 text-[14px] font-semibold text-white hover:opacity-90"
          >
            {locale === "ko" ? "행사 소개" : "About the event"}
            <span aria-hidden>›</span>
          </Link>
          <Link
            href={`/exhibitions/${e.slug}#works`}
            className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white px-7 text-[14px] font-semibold text-ink hover:bg-neutral-50"
          >
            {locale === "ko" ? "참여작 보기" : "View works"}
            <span aria-hidden>›</span>
          </Link>
        </div>
      </div>

      {/* Image (image + gradient placeholder) */}
      <Link href={`/exhibitions/${e.slug}`} className={`block ${flip ? "lg:order-1" : ""}`}>
        <div
          className="aspect-[4/3] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: `url(/images/exhibitions/${e.slug}.jpg), ${e.tint}` }}
          role="img"
          aria-label={e.title[locale]}
        />
      </Link>
    </article>
  );
}

export default function ExhibitionsPage() {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체"
      ? EXHIBITIONS
      : EXHIBITIONS.filter((e) => e.city === filter);

  return (
    <>
      <EditorialHeader
        eyebrow="Exhibitions & Stages"
        title={locale === "ko" ? "전시·공연" : "Exhibitions & Stages"}
        description={
          locale === "ko"
            ? "프랑크푸르트·스폴레토·뉴욕 등 세계 무대에서 열리는 수상작 전시와 공연을 만나보세요."
            : "Discover winners' exhibitions and performances on world stages — Frankfurt, Spoleto, New York, and more."
        }
        crumbs={[{ label: locale === "ko" ? "전시·공연" : "Exhibitions & Stages" }]}
        locale={locale}
      />
      {isLive ? (
        <ProjectCollectionView
          kind="exhibitions"
          locale={locale}
          emptyText={locale === "ko" ? "공개된 전시 프로젝트가 아직 없습니다." : "No exhibition projects published yet."}
        />
      ) : (
      <section className="mx-auto max-w-page px-6">
        {/* Safety notice — these events are demo placeholders, not approved */}
        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
          {locale === "ko"
            ? "표시된 전시·공연은 디자인 데모용 예시이며, 승인·확정된 실제 행사가 아닙니다."
            : "The exhibitions and stages shown are demo placeholders — not approved or confirmed events."}
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 -mx-6 border-b border-line px-6 py-6">
          {EXHIBITION_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                filter === f
                  ? "border-black bg-black text-white"
                  : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {CITY_LABEL[f][locale]}
            </button>
          ))}
        </div>

        {list.length > 0 ? (
          <div>
            {list.map((e, i) => (
              <ExhibitionRow key={e.slug} e={e} flip={i % 2 === 1} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko"
              ? "해당 지역의 전시·공연이 아직 없습니다."
              : "No exhibitions or stages in this location yet."}
          </p>
        )}
      </section>
      )}
    </>
  );
}
