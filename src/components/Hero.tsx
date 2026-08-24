"use client";

import { useEffect, useState } from "react";

type Slide = {
  title: string[];
  desc: string;
  tag: string;
  image: string;
};

// Order matches the reference index (.01 IYAC6, .02 KAJAA, .03 LED wall).
const SLIDES: Slide[] = [
  {
    title: ["2026 6TH IYAC", "YOUTH ART CONTEST"],
    desc: "뉴욕 대형 갤러리 Detour Gallery 수상작 전시 참여 기회가 제공되었으며, 세계적 큐레이터의 심사를 거칩니다.",
    tag: "2026 IYAC6",
    image: "https://picsum.photos/seed/iyac-contest/1920/1080",
  },
  {
    title: ["2026 KAJAA YOUTH", "ART-FESTIVAL EXHIBITION"],
    desc: "2026 KAJAA가 낳은 청소년기 대상과 성장의 존적을 수상작 전시회 제3전시에서 함께 만나 보세요.",
    tag: "2026 KAJAA",
    image: "https://picsum.photos/seed/kajaa-festival/1920/1080",
  },
  {
    title: ["AWARD-WINNING", "ART ON SCREEN"],
    desc: "도심의 대형 스크린 위에 펼쳐진, 청소년 예술가들의 진심 어린 메시지를 만나보세요.",
    tag: "LED wall",
    image: "https://picsum.photos/seed/led-wall-city/1920/1080",
  },
];

export default function Hero() {
  const [index, setIndex] = useState(0);
  const count = SLIDES.length;

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);

  const active = SLIDES[index];

  return (
    <section className="relative h-screen min-h-[640px] w-full overflow-hidden bg-black text-white">
      {/* Background slides */}
      {SLIDES.map((s, i) => (
        <div
          key={s.title.join("")}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]"
          style={{
            backgroundImage: `url(${s.image})`,
            opacity: i === index ? 1 : 0,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-black/35" />

      {/* Content — left inset ~8%, flex column gap 24px, max-width ~893px */}
      <div className="relative flex h-full flex-col justify-center px-[8%]">
        <div className="flex max-w-[893px] flex-col items-start gap-6">
          <h1
            key={index}
            className="font-display text-[52px] leading-[0.95] tracking-[-1.5px] sm:text-[64px] md:text-[80px] md:tracking-[-2.4px]"
          >
            {active.title.map((line, li) => (
              <span key={li} className="block overflow-hidden">
                <span
                  className="hero-word"
                  style={{ animationDelay: `${li * 0.12}s` }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <p className="max-w-md text-[16px] leading-[1.7] text-white">
            {active.desc}
          </p>

          <button className="mt-2 flex h-11 items-center gap-2 rounded-[5px] border border-white/[0.28] bg-white/[0.12] px-[26px] text-[14px] font-bold text-white backdrop-blur-sm hover:bg-white/20">
            View More
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      {/* Bottom-right slide index — name (right-aligned) + .0N number + active bar */}
      <ul className="absolute bottom-14 right-[5%] z-10 flex flex-col items-end gap-3">
        {SLIDES.map((s, i) => {
          const isActive = i === index;
          return (
            <li key={s.tag} className="flex items-center">
              <button
                onClick={() => setIndex(i)}
                className={`font-nav tracking-wide !transition-none ${
                  isActive
                    ? "text-[15px] font-medium text-white"
                    : "text-[13px] text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {s.tag}
              </button>
              <span
                className={`ml-7 text-[11px] tabular-nums ${
                  isActive ? "text-neutral-200" : "text-neutral-500"
                }`}
              >
                .{String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`ml-[7px] h-[21px] w-[3px] ${
                  isActive ? "bg-white" : "bg-transparent"
                }`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
