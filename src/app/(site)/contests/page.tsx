"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  CONTESTS,
  CONTEST_FILTERS,
  CATEGORY_LABEL,
  STATUS_LABEL,
  type Contest,
  type ContestStatus,
} from "@/lib/site-data";
import type { Locale } from "@/lib/i18n";

// Status badge tone — reference vocabulary. Always paired with the status LABEL.
const STATUS_BADGE: Record<ContestStatus, string> = {
  open: "bg-brand-orange",
  upcoming: "bg-neutral-500",
  judging: "bg-brand-blue",
  result: "bg-brand-blue",
  closed: "bg-neutral-500",
};

function statusAction(c: Contest, locale: Locale): { label: string; href: string } {
  const ko = locale === "ko";
  switch (c.status) {
    case "upcoming":
      return { label: ko ? "일정 확인" : "See schedule", href: `/contests/${c.slug}#schedule` };
    case "open":
      return { label: ko ? "접수하기" : "Apply", href: `/submit?contest=${c.slug}` };
    case "judging":
      return { label: ko ? "접수 확인" : "My entry", href: "/mypage" };
    case "result":
      return { label: ko ? "결과 보기" : "See results", href: `/contests/${c.slug}#result` };
    case "closed":
      return { label: ko ? "수상작 보기" : "See winners", href: `/winners?year=${c.deadline.slice(0, 4)}` };
  }
}

function ContestRow({ c, flip, locale }: { c: Contest; flip: boolean; locale: Locale }) {
  const ko = locale === "ko";
  const isSample = c.sample === true;
  const action = statusAction(c, locale);
  return (
    <article className="grid items-center gap-8 border-b border-line py-14 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div className={flip ? "lg:order-2" : ""}>
        <div className="flex items-center gap-2">
          <span className="bg-brand-blue px-[15px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
            {c.categoryEn}
          </span>
          {isSample ? (
            <span className="border border-line px-[13px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-ink-strong">
              {ko ? "샘플 · 준비 중" : "Sample · Coming soon"}
            </span>
          ) : (
            <span
              className={`px-[13px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white ${STATUS_BADGE[c.status]}`}
            >
              {STATUS_LABEL[c.status][locale]}
            </span>
          )}
        </div>

        <Link href={`/contests/${c.slug}`}>
          <h2 className="mt-5 font-title text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.15] tracking-[0.02em] text-ink-strong hover:text-brand-blue">
            {c.title}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.8] text-ink-strong">
          {c.summary[locale]}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] text-ink-strong">
          <span>{c.city}</span>
          <span>{ko ? "접수" : "Entry"} {c.period}</span>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {/* Sample entries never link to Apply — only their (placeholder) detail. */}
          {!isSample && (
            <Link
              href={action.href}
              className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] bg-black px-7 text-[14px] font-semibold text-white hover:opacity-90"
            >
              {action.label}
              <span aria-hidden>›</span>
            </Link>
          )}
          <Link
            href={`/contests/${c.slug}`}
            className="flex h-11 items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white px-7 text-[14px] font-semibold text-ink hover:bg-neutral-50"
          >
            {ko ? "자세히 보기" : "View details"}
            <span aria-hidden>›</span>
          </Link>
        </div>
      </div>

      {/* Poster (image + gradient placeholder) */}
      <Link href={`/contests/${c.slug}`} className={`block ${flip ? "lg:order-1" : ""}`}>
        <div
          className="aspect-[4/3] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: `url(/images/contests/${c.slug}.jpg), ${c.tint}` }}
          role="img"
          aria-label={c.title}
        />
      </Link>
    </article>
  );
}

export default function ContestsPage() {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체" ? CONTESTS : CONTESTS.filter((c) => c.category === filter);

  return (
    <>
      <EditorialHeader
        eyebrow="Contests"
        title={locale === "ko" ? "공모전" : "Competitions"}
        description={
          locale === "ko"
            ? "분야별 국제 청소년 공모전을 탐색하고, 접수 중인 공모전에 바로 지원하세요."
            : "Explore international youth competitions by field and apply directly to open calls."
        }
        crumbs={[{ label: locale === "ko" ? "공모전" : "Competitions" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6">
        {/* Safety notice — samples are demo placeholders, not real open calls */}
        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
          {locale === "ko"
            ? "현재 실제 접수 중인 공모는 Leipzig 2027입니다. ‘샘플 · 준비 중’으로 표시된 항목은 데모용 예시이며, 실제 접수·승인된 행사가 아닙니다."
            : "The only open call right now is Leipzig 2027. Items marked “Sample · Coming soon” are demo placeholders — not real or approved events."}
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 -mx-6 border-b border-line px-6 py-6">
          {CONTEST_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                filter === f
                  ? "border-black bg-black text-white"
                  : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {CATEGORY_LABEL[f][locale]}
            </button>
          ))}
        </div>

        {list.length > 0 ? (
          <div>
            {list.map((c, i) => (
              <ContestRow key={c.slug} c={c} flip={i % 2 === 1} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko"
              ? "해당 분야의 공모전이 아직 없습니다."
              : "No competitions in this field yet."}
          </p>
        )}
      </section>
    </>
  );
}
