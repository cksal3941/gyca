"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { CONTESTS, effectiveContestStatus, type ContestStatus } from "@/lib/site-data";
import { listCompetitionCards, type CompetitionCard } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { unsplashCover } from "@/lib/unsplash";
import type { Bi, Locale } from "@/lib/i18n";

// Home page "events" slider — the same contests the /contests list shows: server-backed
// competitions (live) plus the curated real contests (e.g. VIYBA), newest first. Status and
// Apply follow the schedule; nothing here is hard-coded marketing copy.

type SliderStatus = "open" | "upcoming" | "close";
type EventItem = {
  slug: string;
  latest: boolean;
  status: SliderStatus;
  date: string;
  title: string[];
  desc: string;
  posters: string[];
};

const STATUS_LABEL: Record<SliderStatus, Bi> = {
  open: { en: "OPEN", ko: "접수 중" },
  upcoming: { en: "UPCOMING", ko: "예정" },
  close: { en: "CLOSED", ko: "종료" },
};

const UI = {
  latest: { en: "Latest Event", ko: "최신 공모" } satisfies Bi,
  more: { en: "Learn More", ko: "더 알아보기" } satisfies Bi,
  all: { en: "View All", ko: "전체 보기" } satisfies Bi,
  empty: { en: "Competitions will be announced soon.", ko: "공모전이 곧 공개됩니다." } satisfies Bi,
};

const toSlider = (s: ContestStatus): SliderStatus => (s === "open" || s === "upcoming" ? s : "close");

// Split a long title at the separator so it reads on two lines like the original layout.
const titleLines = (title: string): string[] => {
  const parts = title.split(" | ");
  return parts.length > 1 ? parts : [title];
};

function curatedItems(locale: Locale): EventItem[] {
  return CONTESTS.filter((c) => c.sample !== true).map((c) => ({
    slug: c.slug, latest: false, status: toSlider(effectiveContestStatus(c)),
    date: c.period, title: titleLines(c.title), desc: c.summary[locale],
    posters: c.posters && c.posters.length > 0 ? c.posters : [`/images/${c.slug}.jpg`],
  }));
}

const df = (locale: Locale) => new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { year: "numeric", month: "short", day: "numeric" });
function liveItem(card: CompetitionCard, locale: Locale): EventItem {
  const c = card.competition;
  const p = card.presentation;
  const status: SliderStatus = c.status === "open" || c.status === "upcoming" ? c.status : "close";
  const f = df(locale);
  const date = c.opensAt && c.submissionClosesAtExclusive ? `${f.format(new Date(c.opensAt))} – ${f.format(new Date(c.submissionClosesAtExclusive))}` : "";
  return { slug: c.slug, latest: false, status, date, title: titleLines(c.title[locale]),
    desc: p.summary ? p.summary[locale] : "", posters: [p.cover ? p.cover.src : unsplashCover(c.slug, 800)] };
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EventSlider() {
  const { locale } = useLocale();
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);
  const [liveCards, setLiveCards] = useState<readonly CompetitionCard[]>([]);

  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    listCompetitionCards({ limit: 50 }).then((r) => {
      if (alive && r.kind === "success") setLiveCards(r.data.items);
    });
    return () => { alive = false; };
  }, []);

  // Live competitions first, then curated contests not already backed by a record.
  const events = useMemo<EventItem[]>(() => {
    const live = isLive ? liveCards.map((c) => liveItem(c, locale)) : [];
    const seen = new Set(live.map((e) => e.slug));
    const all = [...live, ...curatedItems(locale).filter((e) => !seen.has(e.slug))];
    return all.map((e, i) => ({ ...e, latest: i === 0 }));
  }, [liveCards, locale]);
  const count = events.length;

  // Preload every poster so a slide change never flashes a gray placeholder.
  useEffect(() => {
    events.forEach((e) =>
      e.posters.forEach((src) => {
        const img = new Image();
        img.src = src;
      }),
    );
  }, [events]);

  // Smooth cross-dissolve: fade the current content out, swap it while it is
  // invisible, then fade the new content in — no hard cut / white flash.
  const go = (d: number) => {
    if (!shown || count === 0) return; // ignore clicks mid-transition
    setShown(false);
    window.setTimeout(() => {
      setIndex((i) => (i + d + count) % count);
      setShown(true);
    }, 260);
  };
  const active = events[Math.min(index, Math.max(0, count - 1))];
  const l: Locale = locale;
  const fadeCls = `transition-opacity duration-[260ms] ease-in-out ${
    shown ? "opacity-100" : "opacity-0"
  }`;

  if (!active) {
    return (
      <section className="bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-page px-6">
          <p className="text-[17px] text-ink-strong">{UI.empty[l]}</p>
          <Link href="/contests" className="mt-6 inline-flex h-11 items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white px-8 text-[14px] font-medium text-ink-strong hover:bg-neutral-50">
            {UI.all[l]}<span aria-hidden>›</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden bg-white py-24 lg:py-28">
      <div className="mx-auto flex max-w-page flex-col gap-12 px-6 lg:flex-row lg:items-center lg:gap-12">
        {/* Left column (426px) */}
        <div className="w-full shrink-0 lg:w-[426px]">
          {/* Counter + arrows */}
          <div className="mb-8 flex items-center gap-3 text-ink-strong">
            <button onClick={() => go(-1)} aria-label={l === "ko" ? "이전" : "Previous"} className="hover:opacity-60">
              <Arrow dir="left" />
            </button>
            <span className="text-[14px] font-semibold tabular-nums tracking-wider">
              {Math.min(index, count - 1) + 1} / {count}
            </span>
            <button onClick={() => go(1)} aria-label={l === "ko" ? "다음" : "Next"} className="hover:opacity-60">
              <Arrow dir="right" />
            </button>
          </div>

          <div className={fadeCls}>
          {/* Badges */}
          <div className="flex items-center gap-2">
            {active.latest && (
              <span className="bg-brand-blue px-[17px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
                {UI.latest[l]}
              </span>
            )}
            <span className={`${active.status === "open" ? "bg-brand-orange" : "bg-neutral-500"} px-[17px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white`}>
              {STATUS_LABEL[active.status][l]}
            </span>
          </div>

          {/* Date */}
          {active.date && <p className="mt-3 text-[14px] font-medium text-ink-strong">{active.date}</p>}

          {/* Title — Korean uses the Pretendard sans face (the Bebas display font
              has no Hangul and reads disharmoniously); Latin keeps Bebas. */}
          <h2
            className={`mt-4 text-[34px] leading-[1.2] text-ink-strong md:text-[40px] md:leading-[48px] ${
              l === "ko"
                ? "font-sans font-bold tracking-[-0.01em]"
                : "font-title tracking-[0.5px]"
            }`}
          >
            {active.title.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>

          {/* Description */}
          {active.desc && (
            <p className="mt-7 text-[17px] leading-[1.7] text-ink-strong">
              {active.desc}
            </p>
          )}

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/contests/${active.slug}`} className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] bg-black text-[14px] font-medium text-white hover:opacity-90">
              {UI.more[l]}
              <span aria-hidden>›</span>
            </Link>
            <Link href="/contests" className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white text-[14px] font-medium text-ink-strong hover:bg-neutral-50">
              {UI.all[l]}
              <span aria-hidden>›</span>
            </Link>
          </div>
          </div>
        </div>

        {/* Right: poster track (5:7), overflows to the right */}
        <div className={`${fadeCls} flex min-w-0 flex-1 gap-[29px]`}>
          {active.posters.map((src) => (
            <Link
              key={src}
              href={`/contests/${active.slug}`}
              className="aspect-[5/7] w-[260px] shrink-0 overflow-hidden bg-neutral-100 sm:w-[340px] lg:w-[400px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={l === "ko" ? "포스터" : "Poster"}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
