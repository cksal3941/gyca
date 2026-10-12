"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  getOpenContests,
  effectiveStatus,
  STATUS_LABEL,
  type Contest,
} from "@/lib/site-data";
import type { Bi, Locale } from "@/lib/i18n";

// Showcase of the currently-recruiting contests, sourced from site-data so the
// home follows the single source of truth. The first open contest is flagged
// "Latest Event"; each card links to its detail page and external apply form.
type EventItem = {
  key: string;
  latest: boolean;
  statusLabel: Bi;
  date: string;
  title: string[];
  desc: Bi;
  posters: string[];
  detailHref: string;
  applyUrl?: string;
};

const UI = {
  latest: { en: "Latest Event", ko: "최신 공모" } satisfies Bi,
  apply: { en: "Apply Now", ko: "접수하기" } satisfies Bi,
  more: { en: "Learn More", ko: "자세히 보기" } satisfies Bi,
  empty: {
    en: "No open calls right now — new contests are announced soon.",
    ko: "현재 접수 중인 공모가 없습니다 — 새로운 공모를 곧 안내합니다.",
  } satisfies Bi,
};

function toEvent(c: Contest, i: number, locale: Locale): EventItem {
  return {
    key: c.slug,
    latest: i === 0,
    statusLabel: STATUS_LABEL[effectiveStatus(c)],
    date: c.period,
    title: c.heroTitle ? c.heroTitle[locale] : [locale === "ko" ? c.title : c.titleEn],
    desc: c.summary,
    posters: c.posters ?? [],
    detailHref: `/contests/${c.slug}`,
    applyUrl: c.applyUrl,
  };
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
  const l: Locale = locale;
  const events = getOpenContests().map((c, i) => toEvent(c, i, l));
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(true);
  const count = events.length;

  // Preload every poster so a slide change never flashes a gray placeholder.
  useEffect(() => {
    events.forEach((e) =>
      e.posters.forEach((src) => {
        const img = new Image();
        img.src = src;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth cross-dissolve: fade the current content out, swap it while it is
  // invisible, then fade the new content in — no hard cut / white flash.
  const go = (d: number) => {
    if (!shown || count <= 1) return; // ignore clicks mid-transition / single card
    setShown(false);
    window.setTimeout(() => {
      setIndex((i) => (i + d + count) % count);
      setShown(true);
    }, 260);
  };

  if (count === 0) {
    return (
      <section className="bg-white py-24 lg:py-28">
        <div className="mx-auto max-w-page px-6 text-[17px] text-ink-strong">
          {UI.empty[l]}
        </div>
      </section>
    );
  }

  const active = events[Math.min(index, count - 1)];
  const fadeCls = `transition-opacity duration-[260ms] ease-in-out ${
    shown ? "opacity-100" : "opacity-0"
  }`;

  return (
    <section className="overflow-hidden bg-white py-24 lg:py-28">
      <div className="mx-auto flex max-w-page flex-col gap-12 px-6 lg:flex-row lg:items-center lg:gap-12">
        {/* Left column (426px) */}
        <div className="w-full shrink-0 lg:w-[426px]">
          {/* Counter + arrows — only when more than one contest is open */}
          {count > 1 && (
            <div className="mb-8 flex items-center gap-3 text-ink-strong">
              <button onClick={() => go(-1)} aria-label={l === "ko" ? "이전" : "Previous"} className="hover:opacity-60">
                <Arrow dir="left" />
              </button>
              <span className="text-[14px] font-semibold tabular-nums tracking-wider">
                {index + 1} / {count}
              </span>
              <button onClick={() => go(1)} aria-label={l === "ko" ? "다음" : "Next"} className="hover:opacity-60">
                <Arrow dir="right" />
              </button>
            </div>
          )}

          <div className={fadeCls}>
          {/* Badges */}
          <div className="flex items-center gap-2">
            {active.latest && (
              <span className="bg-brand-blue px-[17px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
                {UI.latest[l]}
              </span>
            )}
            <span className="bg-brand-orange px-[17px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
              {active.statusLabel[l]}
            </span>
          </div>

          {/* Date */}
          <p className="mt-3 text-[14px] font-medium text-ink-strong">{active.date}</p>

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
          <p className="mt-7 text-[17px] leading-[1.7] text-ink-strong">
            {active.desc[l]}
          </p>

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            {active.applyUrl && (
              <a
                href={active.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] bg-black text-[14px] font-medium text-white hover:opacity-90"
              >
                {UI.apply[l]}
                <span aria-hidden>›</span>
              </a>
            )}
            <Link
              href={active.detailHref}
              className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white text-[14px] font-medium text-ink-strong hover:bg-neutral-50"
            >
              {UI.more[l]}
              <span aria-hidden>›</span>
            </Link>
          </div>
          </div>
        </div>

        {/* Right: poster track (5:7), overflows to the right */}
        <div className={`${fadeCls} flex min-w-0 flex-1 gap-[29px]`}>
          {active.posters.map((src) => (
            <div
              key={src}
              className="aspect-[5/7] w-[260px] shrink-0 overflow-hidden bg-neutral-100 sm:w-[340px] lg:w-[400px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={l === "ko" ? "포스터" : "Poster"}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
