"use client";

import { useState } from "react";

type EventItem = {
  latest: boolean;
  status: string;
  date: string;
  title: string[];
  desc: string;
  posters: string[];
};

const EVENTS: EventItem[] = [
  {
    latest: true,
    status: "open",
    date: "2026.05.06 ~ 07.15",
    title: ["2026 6TH IYAC 글로벌", "청소년 미술 대회"],
    desc: "뉴욕 대형 갤러리 Detour Gallery 수상작 전시 참여 기회가 제공되었으며, 우수한 성적을 작품은 미국 뉴저지 상원의원상 수여 및 코엑스 대형 스크린 전시가 진행 됩니다.",
    posters: [
      "/images/posters/iyac-1.jpg",
      "/images/posters/iyac-2.jpg",
      "/images/posters/iyac-3.jpg",
    ],
  },
  {
    latest: true,
    status: "open",
    date: "2026.03.04 ~ 06.20",
    title: ["2026 KAJAA 한국 청소년", "아트 페스티벌"],
    desc: "대한민국 청소년 창작 미술 대회. 도심 LED 스크린 송출과 오프라인 전시가 함께 진행되며, 우수작은 글로벌 무대로 이어집니다.",
    posters: [
      "/images/posters/kajaa-1.jpg",
      "/images/posters/kajaa-2.jpg",
      "/images/posters/kajaa-3.jpg",
    ],
  },
  {
    latest: false,
    status: "close",
    date: "2025.06.01 ~ 08.30",
    title: ["2025 IYAC Global", "Youth Art Contest"],
    desc: "전 세계 청소년 예술가들이 참여한 글로벌 아트 콘테스트. 뉴욕 Detour Gallery 전시로 마무리되었습니다.",
    posters: [
      "/images/posters/2025-1.jpg",
      "/images/posters/2025-2.jpg",
      "/images/posters/2025-3.jpg",
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
  const [index, setIndex] = useState(0);
  const count = EVENTS.length;
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);
  const active = EVENTS[index];

  return (
    <section className="overflow-hidden bg-white py-24 lg:py-28">
      <div className="mx-auto flex max-w-[1570px] flex-col gap-12 px-6 lg:flex-row lg:items-center lg:gap-12">
        {/* Left column (426px) */}
        <div className="w-full shrink-0 lg:w-[426px]">
          {/* Counter + arrows */}
          <div className="mb-8 flex items-center gap-3 text-neutral-400">
            <button onClick={() => go(-1)} aria-label="이전" className="hover:text-ink">
              <Arrow dir="left" />
            </button>
            <span className="text-[13px] tabular-nums tracking-wider">
              {index + 1} / {count}
            </span>
            <button onClick={() => go(1)} aria-label="다음" className="hover:text-ink">
              <Arrow dir="right" />
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2">
            {active.latest && (
              <span className="bg-brand-blue px-[17px] py-[10px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
                Latest Event
              </span>
            )}
            <span className="bg-brand-orange px-[17px] py-[10px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white">
              {active.status}
            </span>
          </div>

          {/* Date */}
          <p className="mt-3 text-[14px] text-neutral-500">{active.date}</p>

          {/* Title */}
          <h2 className="mt-4 font-title text-[34px] leading-[1.2] tracking-[-0.2px] text-ink-strong md:text-[40px] md:leading-[48px]">
            {active.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>

          {/* Description */}
          <p className="mt-7 text-[16px] leading-[1.6] text-neutral-700">
            {active.desc}
          </p>

          {/* Buttons */}
          <div className="mt-8 flex flex-wrap gap-3">
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] bg-black text-[13px] text-white hover:opacity-90">
              더 알아보기
              <span aria-hidden>›</span>
            </button>
            <button className="flex h-11 w-[207px] items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white text-[13px] text-ink hover:bg-neutral-50">
              전체 보기
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
                alt="포스터"
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
