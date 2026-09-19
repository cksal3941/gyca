"use client";

import { useState } from "react";
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
      en: "A global art book award for ages 7–18. Submit one PDF of 20+ pages including the cover; pass the first international review for an Official Selection Certificate, and up to 30 finalists exhibit in Leipzig. Entry fee €70 per work.",
      ko: "전 세계 만 7–18세 대상 국제 아트북 공모. 표지 포함 20쪽 이상 단일 PDF로 출품하며, 1차 국제심사 통과 시 Official Selection 인증서, 최종 최대 30작품은 라이프치히 국제전시에 진출합니다. 참가비 작품당 €70.",
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
      ko: "무용·발레·피아노·현악·미술 등 다양한 분야를 예선 → 본선 → 해외 Grand Final로 연결하는 공모를 순차적으로 공개할 예정입니다.",
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EventSlider() {
  const { locale } = useLocale();
  const [index, setIndex] = useState(0);
  const count = EVENTS.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);
  const active = EVENTS[index];
  const l: Locale = locale;

  return (
    <section className="overflow-hidden bg-white py-24 lg:py-28">
      <div className="mx-auto flex max-w-page flex-col gap-12 px-6 lg:flex-row lg:items-center lg:gap-12">
        {/* Left column (426px) */}
        <div className="w-full shrink-0 lg:w-[426px]">
          {/* Counter + arrows */}
          <div className="mb-8 flex items-center gap-3 text-neutral-400">
            <button onClick={() => go(-1)} aria-label={l === "ko" ? "이전" : "Previous"} className="hover:text-ink">
              <Arrow dir="left" />
            </button>
            <span className="text-[13px] tabular-nums tracking-wider">
              {index + 1} / {count}
            </span>
            <button onClick={() => go(1)} aria-label={l === "ko" ? "다음" : "Next"} className="hover:text-ink">
              <Arrow dir="right" />
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            {active.latest && (
              <span className="bg-brand-blue px-[17px] py-[10px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
                {UI.latest[l]}
              </span>
            )}
            <span className="bg-brand-orange px-[17px] py-[10px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
              {STATUS_LABEL[active.status][l]}
            </span>
          </div>

          {/* Date */}
          <p className="mt-3 text-[14px] text-neutral-500">{active.date[l]}</p>

          {/* Title */}
          <h2 className="mt-4 font-title text-[34px] leading-[1.2] tracking-[0.5px] text-ink-strong md:text-[40px] md:leading-[48px]">
            {active.title[l].map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>

          {/* Description */}
          <p className="mt-7 text-[16px] leading-[1.6] text-neutral-700">
            {active.desc[l]}
          </p>

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] bg-black text-[13px] text-white hover:opacity-90">
              {UI.more[l]}
              <span aria-hidden>›</span>
            </button>
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white text-[13px] text-ink hover:bg-neutral-50">
              {UI.all[l]}
              <span aria-hidden>›</span>
            </button>
          </div>
        </div>

        {/* Right: poster track (5:7), overflows to the right */}
        <div className="flex min-w-0 flex-1 gap-[29px]">
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
