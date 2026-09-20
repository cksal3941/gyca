"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Bi, BiLines, Locale } from "@/lib/i18n";

type EventItem = {
  latest: boolean;
  status: "open" | "upcoming" | "close";
  date: Bi;
  title: BiLines;
  desc: Bi;
  posters: string[];
};

const STATUS_LABEL: Record<EventItem["status"], Bi> = {
  open: { en: "OPEN", ko: "접수 중" },
  upcoming: { en: "UPCOMING", ko: "예정" },
  close: { en: "CLOSED", ko: "종료" },
};

const UI = {
  latest: { en: "Latest Event", ko: "최신 공모" } satisfies Bi,
  more: { en: "Learn More", ko: "더 알아보기" } satisfies Bi,
  all: { en: "View All", ko: "전체 보기" } satisfies Bi,
};

const EVENTS: EventItem[] = [
  {
    latest: true,
    status: "open",
    date: { en: "14 Sep – 31 Dec 2026", ko: "2026.09.14 ~ 12.31" },
    title: {
      en: ["2027 GYCA International Youth", "Art Book Awards"],
      ko: ["2027 GYCA 국제 청소년", "아트북 어워드"],
    },
    desc: {
      en: "The international award where creators aged 7–18 make their global debut. Earn recognition as an artist the world is watching, and see your book take the stage at the Leipzig international exhibition.",
      ko: "만 7–18세 창작자가 자신의 아트북으로 세계 무대에 데뷔하는 국제 어워드. 세계가 주목하는 어린 작가로 인정받고, 당신의 책이 라이프치히 국제 전시의 주인공이 됩니다.",
    },
    posters: [
      "/images/posters/iyac-1.jpg",
      "/images/posters/iyac-2.jpg",
      "/images/posters/iyac-3.jpg",
    ],
  },
  {
    latest: false,
    status: "upcoming",
    date: { en: "TBA", ko: "추후 공개" },
    title: {
      en: ["Future Genres", "Coming Soon"],
      ko: ["향후 분야", "Coming Soon"],
    },
    desc: {
      en: "Dance, ballet, piano, strings and visual art rounds will open in stages, connecting preliminary and final rounds to overseas Grand Finals.",
      ko: "무용·발레·피아노·현악·미술 등 다양한 분야를 예선부터 본선, 해외 Grand Final까지 연결하는 공모를 순차적으로 공개할 예정입니다.",
    },
    posters: [
      "/images/posters/kajaa-1.jpg",
      "/images/posters/kajaa-2.jpg",
      "/images/posters/kajaa-3.jpg",
    ],
  },
];

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
  const count = EVENTS.length;

  // Preload every poster so a slide change never flashes a gray placeholder.
  useEffect(() => {
    EVENTS.forEach((e) =>
      e.posters.forEach((src) => {
        const img = new Image();
        img.src = src;
      }),
    );
  }, []);

  // Smooth cross-dissolve: fade the current content out, swap it while it is
  // invisible, then fade the new content in — no hard cut / white flash.
  const go = (d: number) => {
    if (!shown) return; // ignore clicks mid-transition
    setShown(false);
    window.setTimeout(() => {
      setIndex((i) => (i + d + count) % count);
      setShown(true);
    }, 260);
  };
  const active = EVENTS[index];
  const l: Locale = locale;
  const fadeCls = `transition-opacity duration-[260ms] ease-in-out ${
    shown ? "opacity-100" : "opacity-0"
  }`;

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
              {index + 1} / {count}
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
            <span className="bg-brand-orange px-[17px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-[0.3px] text-white">
              {STATUS_LABEL[active.status][l]}
            </span>
          </div>

          {/* Date */}
          <p className="mt-3 text-[14px] font-medium text-ink-strong">{active.date[l]}</p>

          {/* Title — Korean uses the Pretendard sans face (the Bebas display font
              has no Hangul and reads disharmoniously); Latin keeps Bebas. */}
          <h2
            className={`mt-4 text-[34px] leading-[1.2] text-ink-strong md:text-[40px] md:leading-[48px] ${
              l === "ko"
                ? "font-sans font-bold tracking-[-0.01em]"
                : "font-title tracking-[0.5px]"
            }`}
          >
            {active.title[l].map((line, i) => (
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
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] bg-black text-[14px] font-medium text-white hover:opacity-90">
              {UI.more[l]}
              <span aria-hidden>›</span>
            </button>
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white text-[14px] font-medium text-ink-strong hover:bg-neutral-50">
              {UI.all[l]}
              <span aria-hidden>›</span>
            </button>
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
