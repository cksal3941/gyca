"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  EXHIBITIONS,
  EXHIBITION_TYPE_FILTERS,
  EXHIBITION_TYPE_LABEL,
  type Exhibition,
  type ExhibitionType,
} from "@/lib/site-data";
import type { Locale } from "@/lib/i18n";
import { coverBg } from "@/lib/unsplash";

// Exhibitions & performances are documented with landscape event photos (venue,
// stage, audience) — so this keeps the wide editorial cards, unlike the poster
// grid on /contests. Content is placeholder (virtual events) for design preview.
function ExhibitionRow({ e, flip, locale }: { e: Exhibition; flip: boolean; locale: Locale }) {
  const ko = locale === "ko";
  return (
    <article className="grid items-center gap-8 border-b border-line py-14 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <span className="inline-block bg-brand-blue px-[15px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
          {EXHIBITION_TYPE_LABEL[e.type][locale]}
        </span>
        <Link href={`/exhibitions/${e.slug}`}>
          <h2
            className={`mt-5 break-keep text-[clamp(26px,3.2vw,38px)] font-bold leading-[1.2] text-ink-strong hover:text-brand-blue ${
              ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"
            }`}
          >
            {e.title[locale]}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.8] text-ink-strong">
          {e.summary[locale]}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] text-ink-strong">
          <span>{e.city[locale]}</span>
          <span>{e.date}</span>
        </div>
        <div className="mt-8">
          <Link
            href={`/exhibitions/${e.slug}`}
            className="inline-flex h-11 w-fit items-center justify-center gap-[10px] rounded-[7px] bg-black px-7 text-[14px] font-semibold text-white hover:opacity-90"
          >
            {ko ? "행사 소개" : "About the event"}
            <span aria-hidden>›</span>
          </Link>
        </div>
      </div>

      <Link href={`/exhibitions/${e.slug}`} className={`block ${flip ? "lg:order-1" : ""}`}>
        <div
          className="aspect-[4/3] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: coverBg(e.slug, `/images/exhibitions/${e.slug}.jpg`) }}
          role="img"
          aria-label={e.title[locale]}
        />
      </Link>
    </article>
  );
}

export default function ExhibitionsPage() {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const [type, setType] = useState<string>("전체");
  const list = type === "전체" ? EXHIBITIONS : EXHIBITIONS.filter((e) => e.type === type);

  return (
    <>
      <EditorialHeader
        eyebrow="Exhibitions & Stages"
        title={ko ? "전시·공연" : "Exhibitions & Stages"}
        description={
          ko
            ? "세계 무대에서 열리는 전시와 공연."
            : "Exhibitions and performances on the world stage."
        }
        crumbs={[{ label: ko ? "전시·공연" : "Exhibitions & Stages" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6">
        {/* Safety notice — these events are demo placeholders, not approved */}
        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
          {ko
            ? "표시된 전시·공연은 디자인 데모용 예시이며, 승인·확정된 실제 행사가 아닙니다."
            : "The exhibitions and stages shown are demo placeholders — not approved or confirmed events."}
        </div>

        {/* Type tabs */}
        <div className="flex flex-wrap gap-2 border-b border-line py-6">
          {EXHIBITION_TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setType(f)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                type === f
                  ? "border-black bg-black text-white"
                  : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {f === "전체"
                ? ko
                  ? "전체"
                  : "All"
                : EXHIBITION_TYPE_LABEL[f as ExhibitionType][locale]}
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
            {ko ? "해당 종류의 전시·공연이 아직 없습니다." : "No events of this type yet."}
          </p>
        )}
      </section>
    </>
  );
}
