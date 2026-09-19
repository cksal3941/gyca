"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Bi, BiLines } from "@/lib/i18n";

type Slide = {
  title: BiLines;
  desc: Bi;
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
      en: "A global art book award for young creators aged 7–18. Submit one PDF of 20+ pages including the cover.",
      ko: "전 세계 만 7–18세를 위한 국제 아트북 공모. 표지 포함 20쪽 이상 단일 PDF로 출품합니다.",
    },
    tag: "Leipzig 2027",
    image: "/images/hero/iyac.jpg",
  },
  {
    title: {
      en: ["YOUR BOOK. YOUR STORY.", "NEXT STOP, LEIPZIG."],
      ko: ["당신의 책, 당신의 이야기.", "다음 무대는 라이프치히."],
    },
    desc: {
      en: "Pass the first international review to earn a GYCA Official Selection Certificate.",
      ko: "1차 국제심사를 통과하면 GYCA Official Selection 인증서를 받습니다.",
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
      en: "Up to 30 works advance to the Leipzig international exhibition.",
      ko: "최대 30작품이 라이프치히 국제전시에 진출합니다.",
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
            className="font-display text-[52px] leading-[0.95] tracking-[0.5px] sm:text-[64px] md:text-[80px] md:tracking-[1px]"
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

          <p className="max-w-md text-[16px] leading-[1.7] text-white">
            {active.desc[locale]}
          </p>

          <button className="mt-2 flex h-11 items-center gap-2 rounded-[5px] border border-white/[0.28] bg-white/[0.12] px-[26px] text-[14px] font-bold text-white backdrop-blur-sm hover:bg-white/20">
            {locale === "ko" ? "자세히 보기" : "View More"}
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
