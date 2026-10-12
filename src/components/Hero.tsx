"use client";

import { useEffect, useState } from "react";
import { ChevronsDown } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  getFeaturedContest,
  effectiveStatus,
  STATUS_LABEL,
} from "@/lib/site-data";
import type { BiLines } from "@/lib/i18n";

// Two editorial story slides. Copy is Vienna/VIYBA-themed; the apply/detail
// links and deadline pill are sourced from the featured (open) contest so the
// Hero stays wired to the single source of truth as contests change.
type Slide = {
  tag: string;
  title: BiLines;
  desc: BiLines;
  image: string;
  apply?: boolean; // show the "Apply Now" CTA + deadline pill on this slide
};

const SLIDES: Slide[] = [
  {
    tag: "Open Call",
    title: {
      en: ["YOUR BOOK, YOUR STORY", "ON STAGE IN VIENNA"],
      ko: ["당신의 책, 당신의 이야기", "무대는 비엔나로"],
    },
    desc: {
      en: ["Your story, recognized by the world.", "A VIYBA selection is where it begins."],
      ko: ["당신의 작은 이야기가 세계의 인정을 받습니다.", "VIYBA 선정이 그 첫 무대입니다."],
    },
    image: "/images/VIYBA_slide.webp",
    apply: true,
  },
  {
    tag: "Finalist",
    title: {
      en: ["FINALISTS GO", "TO VIENNA"],
      ko: ["Finalist는", "비엔나로"],
    },
    desc: {
      en: ["Meet a global audience in Vienna.", "Your book takes center stage at an international exhibition."],
      ko: ["비엔나에서 세계 관객과 마주하세요.", "당신의 책이 국제 전시의 주인공이 됩니다."],
    },
    image: "/images/led-wall.jpg",
  },
];

export default function Hero() {
  const { locale } = useLocale();
  const [index, setIndex] = useState(0);
  const count = SLIDES.length;

  // Live links / deadline for the currently-recruiting contest.
  const featured = getFeaturedContest();
  const applyUrl = featured?.applyUrl;
  const detailHref = featured ? `/contests/${featured.slug}` : "/contests";
  const statusLabel = featured ? STATUS_LABEL[effectiveStatus(featured)] : null;
  const period = featured?.period ?? "";

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(id);
  }, [count]);

  const active = SLIDES[index];
  const showApply = Boolean(active.apply && featured);

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
          {/* Status + deadline pill (recruiting slide only) */}
          {showApply && statusLabel && (
            <span className="flex items-center gap-2 rounded-full bg-brand-teal px-4 py-1.5 text-[14px] font-bold text-white">
              {statusLabel[locale]}
              {period && (
                <span className="font-semibold text-white/90">· {period}</span>
              )}
            </span>
          )}

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

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {showApply && applyUrl && (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center gap-2 rounded-[5px] bg-white px-[26px] text-[14px] font-bold text-black hover:bg-white/90"
              >
                {locale === "ko" ? "접수하기" : "Apply Now"}
                <span aria-hidden>›</span>
              </a>
            )}
            <Link
              href={detailHref}
              className="flex h-11 items-center gap-2 rounded-[5px] border border-white/[0.28] bg-white/[0.12] px-[26px] text-[14px] font-bold text-white backdrop-blur-sm hover:bg-white/20"
            >
              {locale === "ko" ? "자세히 보기" : "View More"}
              <span aria-hidden>›</span>
            </Link>
          </div>
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
