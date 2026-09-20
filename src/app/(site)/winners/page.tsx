"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  WINNERS,
  WINNER_YEARS,
  AWARD_LEVELS,
  CONTEST_FILTERS,
  CATEGORY_LABEL,
  AWARD_LABEL,
  AWARD_COLOR,
  ALL,
  type Winner,
} from "@/lib/site-data";
import type { Bi, Locale } from "@/lib/i18n";
import { coverBg } from "@/lib/unsplash";

/** Award pill shown below the image (light chip, dark text + colored dot).
 *  Carries a "sample" marker — these are demo placeholders, not real results. */
function AwardChip({ w, locale }: { w: Winner; locale: Locale }) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-[14px] font-semibold text-ink-strong">
      <span className={`h-1.5 w-1.5 rounded-full ${AWARD_COLOR[w.award]}`} />
      {w.award}
      <span className="ml-1 border-l border-line pl-1.5 text-[13px] font-bold uppercase tracking-[0.06em]">
        {locale === "ko" ? "예시" : "Sample"}
      </span>
    </span>
  );
}

const bg = (w: Winner) => ({
  backgroundImage: coverBg(w.slug, `/images/winners/${w.slug}.jpg`),
});

/** Large featured winner — full-width image with the caption below it. */
function FeaturedWinner({ w, locale }: { w: Winner; locale: Locale }) {
  return (
    <Link href={`/winners/${w.slug}`} className="group mt-6 block">
      <div className="aspect-[16/10] w-full overflow-hidden ring-1 ring-black/5 sm:aspect-[16/8] lg:aspect-[21/9]">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-[1.03]"
          style={bg(w)}
          role="img"
          aria-label={w.title}
        />
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <AwardChip w={w} locale={locale} />
        <h2 className="max-w-[22ch] break-keep font-title text-[clamp(34px,6vw,76px)] font-bold leading-[1.0] tracking-[0.01em] text-ink-strong group-hover:text-brand-blue">
          {w.title}
        </h2>
        <p className="text-[16px] text-ink-strong">
          {w.artist} · {w.country} · {CATEGORY_LABEL[w.category]?.[locale] ?? w.category} · {w.year}
        </p>
      </div>
    </Link>
  );
}

/** Grid card — image on top, caption below. */
function WinnerCard({ w, locale }: { w: Winner; locale: Locale }) {
  return (
    <Link href={`/winners/${w.slug}`} className="group block">
      <div className="aspect-[3/4] w-full overflow-hidden ring-1 ring-black/5">
        <div
          className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={bg(w)}
          role="img"
          aria-label={w.title}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <AwardChip w={w} locale={locale} />
        <h3 className="break-keep font-title text-[clamp(20px,2.2vw,28px)] font-bold leading-[1.08] tracking-[0.01em] text-ink-strong group-hover:text-brand-blue">
          {w.title}
        </h3>
        <p className="text-[16px] text-ink-strong">
          {w.artist} · {w.year}
        </p>
      </div>
    </Link>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  labelFor: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-16 shrink-0 text-[16px] font-semibold text-ink-strong">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
            value === o
              ? "border-black bg-black text-white"
              : "border-field text-ink hover:border-black hover:text-ink-strong"
          }`}
        >
          {labelFor(o)}
        </button>
      ))}
    </div>
  );
}

export default function WinnersPage() {
  const { locale } = useLocale();
  const [year, setYear] = useState<string>("전체");
  const [award, setAward] = useState<string>("전체");
  const [category, setCategory] = useState<string>("전체");
  const [query, setQuery] = useState<string>("");

  const map = (m: Record<string, Bi>, l: Locale) => (v: string) => m[v]?.[l] ?? v;
  const yearLabel = (v: string) => (v === "전체" ? ALL[locale] : v);

  const q = query.trim().toLowerCase();
  const list = WINNERS.filter((w) => {
    if (year !== "전체" && w.year !== year) return false;
    if (award !== "전체" && w.award !== award) return false;
    if (category !== "전체" && w.category !== category) return false;
    if (
      q &&
      ![w.title, w.artist, w.country, w.category].some((f) => f.toLowerCase().includes(q))
    )
      return false;
    return true;
  });
  const [featured, ...rest] = list;

  return (
    <>
      <EditorialHeader
        eyebrow="Winners"
        title={locale === "ko" ? "수상작" : "Winners"}
        crumbs={[{ label: locale === "ko" ? "수상작" : "Winners" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6 pb-16">
        {/* Safety notice — these winners are demo placeholders, not real results */}
        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
          {locale === "ko"
            ? "표시된 수상작은 디자인 데모용 예시이며, 실제 수상 실적·수상자가 아닙니다. 실제 결과는 심사 종료 후 공개됩니다."
            : "The winners shown are demo placeholders — not real results or awardees. Actual results are published after judging."}
        </div>
        {list.length > 0 && featured && <FeaturedWinner w={featured} locale={locale} />}

        {/* Filters */}
        <div className="mt-10 space-y-4 -mx-6 border-b border-line px-6 py-6">
          <FilterRow label={locale === "ko" ? "연도" : "Year"} options={WINNER_YEARS} value={year} onChange={setYear} labelFor={yearLabel} />
          <FilterRow label={locale === "ko" ? "수상" : "Award"} options={AWARD_LEVELS} value={award} onChange={setAward} labelFor={map(AWARD_LABEL, locale)} />
          <FilterRow label={locale === "ko" ? "부문" : "Field"} options={CONTEST_FILTERS} value={category} onChange={setCategory} labelFor={map(CATEGORY_LABEL, locale)} />
          <div className="pt-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                locale === "ko"
                  ? "참가자 이름, 접수번호, 작품명, 국가, 부문"
                  : "Name, entry no., work title, country, field"
              }
              className="w-full rounded-lg border border-field px-4 py-3 text-[16px] text-ink-strong placeholder:text-ink-strong focus:border-black focus:outline-none"
            />
          </div>
        </div>

        {list.length > 0 ? (
          rest.length > 0 ? (
            <div className="grid gap-x-6 gap-y-16 py-12 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((w) => (
                <WinnerCard key={w.slug} w={w} locale={locale} />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-[16px] text-ink-strong">
              {locale === "ko" ? "대표 수상작 외 추가 작품이 없습니다." : "No further winners in this view."}
            </p>
          )
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko" ? "조건에 맞는 수상작이 없습니다." : "No winners match your filters."}
          </p>
        )}
      </section>
    </>
  );
}
