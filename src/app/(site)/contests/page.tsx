"use client";

import { useEffect, useState } from "react";
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
import { listCompetitionCards, canStartEntry, type CompetitionCard } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { coverBg } from "@/lib/unsplash";
import type { Locale } from "@/lib/i18n";

// Contests list (dual-mode). Live: GET /content/competition-cards — real
// competitions with server status/readiness/allowedActions driving Apply, plus
// optional presentation copy (summary/category/city/cover, any may be null).
// Mock: the curated sample rows (design demo, marked "Sample · Coming soon").
// Both map to a common row view-model so the layout is identical.

// Status badge tone — reference vocabulary. Always paired with the status LABEL.
const STATUS_BADGE: Record<ContestStatus, string> = {
  open: "bg-brand-orange",
  upcoming: "bg-neutral-500",
  judging: "bg-brand-blue",
  result: "bg-brand-blue",
  closed: "bg-neutral-500",
};

// Status filter — works in both live and mock (each row carries a status).
const STATUS_FILTERS = [
  { key: "all", ko: "전체", en: "All" },
  { key: "open", ko: "접수 중", en: "Open" },
  { key: "upcoming", ko: "접수 예정", en: "Upcoming" },
  { key: "closed", ko: "종료", en: "Closed" },
] as const;
function statusMatch(s: ContestStatus, key: string): boolean {
  if (key === "all") return true;
  if (key === "closed") return s === "closed" || s === "judging" || s === "result";
  return s === key;
}

// Row view-model — the single shape the row renders from.
type RowVM = {
  slug: string;
  title: string;
  categoryLabel: string | null; // blue badge; null → hidden
  summary: string | null;
  city: string | null;
  period: string | null;
  status: ContestStatus;
  coverSrc: string | null; // live cover; mock uses /images/contests/{slug}.jpg
  tint: string;
  sample: boolean;
  applyHref: string | null; // null → no Apply CTA (server-gated in live)
};

function mockToRow(c: Contest, locale: Locale): RowVM {
  return {
    slug: c.slug,
    title: c.title,
    categoryLabel: c.categoryEn,
    summary: c.summary[locale],
    city: c.city,
    period: c.period,
    status: c.status,
    coverSrc: `/images/contests/${c.slug}.jpg`,
    tint: c.tint,
    sample: c.sample === true,
    // Samples never link to Apply; real (Leipzig) uses its open call.
    applyHref: c.sample ? null : c.status === "open" ? `/submit?contest=${c.slug}` : null,
  };
}

const NEUTRAL_TINT = "linear-gradient(135deg,#e8edf5,#cdd7e6)";
const df = (locale: Locale) => new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
function entryWindow(card: CompetitionCard, locale: Locale): string | null {
  const { opensAt, submissionClosesAtExclusive } = card.competition;
  if (!opensAt || !submissionClosesAtExclusive) return null;
  const f = df(locale);
  return `${f.format(new Date(opensAt))} – ${f.format(new Date(submissionClosesAtExclusive))}`;
}

function liveToRow(card: CompetitionCard, locale: Locale): RowVM {
  const c = card.competition;
  const p = card.presentation;
  // "archived" has no contest badge vocabulary — render as closed.
  const status: ContestStatus = c.status === "archived" ? "closed" : c.status;
  return {
    slug: c.slug,
    title: c.title[locale],
    categoryLabel: p.category ? p.category[locale] : null,
    summary: p.summary ? p.summary[locale] : null,
    city: p.city ? p.city[locale] : null,
    period: entryWindow(card, locale),
    status,
    coverSrc: p.cover ? p.cover.src : null,
    tint: NEUTRAL_TINT,
    sample: false,
    // Apply is offered ONLY when the server allows start_entry.
    applyHref: canStartEntry(c) ? `/submit?contest=${c.slug}` : null,
  };
}

// Poster-first card: portrait (3:4) poster image + compact meta below, the way
// competitions are actually promoted. The whole poster/title links to detail;
// an Apply CTA shows only when the server allows it.
function ContestCard({ r, locale }: { r: RowVM; locale: Locale }) {
  const ko = locale === "ko";
  const applyLabel = r.status === "open" ? (ko ? "접수하기" : "Apply") : ko ? "자세히 보기" : "View details";
  return (
    <article className="group flex flex-col">
      <Link href={`/contests/${r.slug}`} className="block overflow-hidden ring-1 ring-black/5">
        <div
          className="aspect-[3/4] w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ backgroundImage: coverBg(r.slug, r.coverSrc, 800) }}
          role="img"
          aria-label={r.title}
        />
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.categoryLabel && (
          <span className="bg-brand-blue px-[13px] py-[8px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
            {r.categoryLabel}
          </span>
        )}
        {r.sample ? (
          <span className="border border-line px-[11px] py-[8px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-ink-strong">
            {ko ? "샘플" : "Sample"}
          </span>
        ) : (
          <span
            className={`px-[11px] py-[8px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white ${STATUS_BADGE[r.status]}`}
          >
            {STATUS_LABEL[r.status][locale]}
          </span>
        )}
      </div>

      <Link href={`/contests/${r.slug}`}>
        <h2
          className={`mt-3 break-keep text-[22px] font-bold leading-[1.25] text-ink-strong group-hover:text-brand-blue ${
            ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"
          }`}
        >
          {r.title}
        </h2>
      </Link>
      {r.period && (
        <p className="mt-2 text-[16px] text-ink-strong">
          {ko ? "접수" : "Entry"} {r.period}
        </p>
      )}

      {r.applyHref && (
        <Link
          href={r.applyHref}
          className="mt-4 inline-flex h-11 w-fit items-center justify-center gap-[10px] rounded-[7px] bg-black px-6 text-[14px] font-semibold text-white hover:opacity-90"
        >
          {applyLabel}
          <span aria-hidden>›</span>
        </Link>
      )}
    </article>
  );
}

export default function ContestsPage() {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("전체");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [liveRows, setLiveRows] = useState<RowVM[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(isLive ? "loading" : "ready");

  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    listCompetitionCards({ limit: 50 }).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { setLiveRows(r.data.items.map((c) => liveToRow(c, locale))); setPhase("ready"); }
      else if (r.kind === "empty") { setLiveRows([]); setPhase("ready"); }
      else setPhase("error");
    });
    return () => { alive = false; };
  }, [locale]);

  const mockList =
    filter === "전체" ? CONTESTS : CONTESTS.filter((c) => c.category === filter);
  const rows: RowVM[] = isLive ? (liveRows ?? []) : mockList.map((c) => mockToRow(c, locale));
  const visibleRows = rows.filter((r) => statusMatch(r.status, statusFilter));

  return (
    <>
      <EditorialHeader
        eyebrow="Contests"
        title={locale === "ko" ? "공모전" : "Competitions"}
        description={
          locale === "ko"
            ? "국제 청소년 공모전을 만나보세요."
            : "Discover international youth competitions."
        }
        crumbs={[{ label: locale === "ko" ? "공모전" : "Competitions" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6">
        {/* Mock-only: samples are demo placeholders, not real open calls. */}
        {!isLive && (
          <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
            {locale === "ko"
              ? "현재 실제 접수 중인 공모는 Leipzig 2027입니다. ‘샘플 · 준비 중’으로 표시된 항목은 데모용 예시이며, 실제 접수·승인된 행사가 아닙니다."
              : "The only open call right now is Leipzig 2027. Items marked “Sample · Coming soon” are demo placeholders — not real or approved events."}
          </div>
        )}
        {/* Category filter (mock only — live presentation category is free copy) */}
        {!isLive && (
          <div className="flex flex-wrap gap-2 pt-6">
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
        )}
        {/* Status filter (live + mock) */}
        <div className="flex flex-wrap gap-2 border-b border-line py-6">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                statusFilter === f.key
                  ? "border-black bg-black text-white"
                  : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {locale === "ko" ? f.ko : f.en}
            </button>
          ))}
        </div>

        {phase === "loading" ? (
          <p className="py-24 text-center text-[16px] text-ink-strong">{locale === "ko" ? "불러오는 중…" : "Loading…"}</p>
        ) : phase === "error" ? (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko" ? "공모전을 불러오지 못했습니다. 잠시 후 다시 시도하세요." : "Could not load competitions. Please try again shortly."}
          </p>
        ) : visibleRows.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 py-12 md:grid-cols-3 lg:gap-x-8">
            {visibleRows.map((r) => (
              <ContestCard key={r.slug} r={r} locale={locale} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {rows.length === 0
              ? locale === "ko"
                ? "공개된 공모전이 아직 없습니다."
                : "No competitions published yet."
              : locale === "ko"
                ? "해당 조건의 공모전이 없습니다."
                : "No competitions match this filter."}
          </p>
        )}
      </section>
    </>
  );
}
