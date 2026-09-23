"use client";

import { useEffect, useState } from "react";
import { ChevronsDown } from "lucide-react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { BiLines } from "@/lib/i18n";

type Slide = {
  title: BiLines;
  desc: BiLines;
  tag: string;
  image: string;
};

// First launch: Leipzig 2027 art book award (copy from the GYCA Leipzig 2027 brief).
const SLIDES: Slide[] = [
  {
    title: {
      en: ["2027 GYCA INTERNATIONAL", "YOUTH ART BOOK AWARDS"],
      ko: ["2027 GYCA 국제", "청소년 아트북 어워드"],
    },
    desc: {
      en: ["The world is waiting for your art.", "An art book award where creators aged 7–18 debut on the global stage."],
      ko: ["세상이 당신의 그림을 기다립니다.", "7–18세 창작자가 국제 무대에 데뷔하는 아트북 어워드."],
    },
    tag: "Leipzig 2027",
    image: "/images/hero/iyac.jpg",
  },
  {
    title: {
      en: ["YOUR BOOK, YOUR STORY", "NEXT STOP, LEIPZIG"],
      ko: ["당신의 책, 당신의 이야기", "다음 무대는 라이프치히"],
    },
    desc: {
      en: ["Your story, recognized by the world.", "A GYCA Official Selection is where it begins."],
      ko: ["당신의 작은 이야기가 세계의 인정을 받습니다.", "GYCA 공식 선정이 그 첫 무대입니다."],
    },
    tag: "Open Call",
    image: "/images/hero/kajaa.jpg",
  },
  {
    title: {
      en: ["FINALISTS GO", "TO LEIPZIG"],
      ko: ["Finalist는", "라이프치히로"],
    },
    desc: {
      en: ["Meet a global audience in Leipzig.", "Your book takes center stage at an international exhibition."],
      ko: ["라이프치히에서 세계 관객과 마주하세요.", "당신의 책이 국제 전시의 주인공이 됩니다."],
    },
    tag: "Finalist",
    image: "/images/hero/led-wall.jpg",
  },
];

export default function Hero() {
  const { locale } = useLocale();
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
          key={s.tag}
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
            key={`${index}-${locale}`}
            className={`text-[52px] sm:text-[64px] md:text-[80px] ${
              locale === "ko"
                ? "font-sans font-bold leading-[1.15] tracking-[-0.01em]"
                : "font-display leading-[0.95] tracking-[0.5px] md:tracking-[1px]"
            }`}
          >
            {active.title[locale].map((line, li) => (
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

          <p className="max-w-lg text-[18px] leading-[1.7] text-white">
            {active.desc[locale].map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {line}
              </span>
            ))}
          </p>

          <button className="mt-2 flex h-11 items-center gap-2 rounded-[5px] border border-white/[0.28] bg-white/[0.12] px-[26px] text-[14px] font-bold text-white backdrop-blur-sm hover:bg-white/20">
            {locale === "ko" ? "자세히 보기" : "View More"}
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      {/* Bottom-center scroll-down hint */}
      <button
        type="button"
        onClick={() =>
          window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
        }
        aria-label={locale === "ko" ? "아래로 스크롤" : "Scroll down"}
        className="absolute bottom-9 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/80 hover:text-white"
      >
        <span className="text-[14px] font-semibold uppercase tracking-[0.3em]">
          Scroll
        </span>
        <ChevronsDown className="scroll-chevron h-5 w-5" strokeWidth={1.75} />
      </button>

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
                    : "text-[14px] text-white/70 hover:text-white"
                }`}
              >
                {s.tag}
              </button>
              <span
                className={`ml-7 text-[14px] tabular-nums ${
                  isActive ? "text-white/90" : "text-white/60"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
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
