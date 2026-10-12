"use client";

import { useEffect, useState } from "react";

/** Manual (no auto-play) poster slider shown small inside a fixed box. Clicking
 *  a poster opens a full-screen lightbox to view it in detail. Arrow keys / Esc
 *  work while the lightbox is open. */
export default function PosterSlider({
  images,
  labels,
  locale = "en",
}: {
  images: string[];
  labels?: string[];
  locale?: "en" | "ko";
}) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const go = (d: number) => setI((p) => (p + d + n) % n);
  const ko = locale === "ko";
  const alt = (k: number) => labels?.[k] ?? (ko ? `포스터 ${k + 1}` : `Poster ${k + 1}`);
  const T = {
    enlarge: ko ? "클릭하여 크게 보기" : "Click to enlarge",
    viewLarger: ko ? "포스터 크게 보기" : "View poster larger",
    prev: ko ? "이전 포스터" : "Previous poster",
    next: ko ? "다음 포스터" : "Next poster",
    close: ko ? "닫기" : "Close",
    dialog: ko ? "포스터 자세히 보기" : "View poster",
    goTo: (k: number) => (ko ? `${k + 1}번 포스터로 이동` : `Go to poster ${k + 1}`),
  };

  // Keyboard controls + body scroll lock while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, n]);

  const ArrowBtn = ({
    dir,
    onClick,
    tone,
  }: {
    dir: "prev" | "next";
    onClick: () => void;
    tone: "light" | "dark";
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={dir === "prev" ? T.prev : T.next}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-[20px] font-bold shadow-md ring-1 transition ${
        dir === "prev" ? "left-2" : "right-2"
      } ${
        tone === "light"
          ? "bg-white/90 text-ink-strong ring-black/10 hover:bg-white"
          : "bg-white/15 text-white ring-white/30 hover:bg-white/25"
      }`}
    >
      {dir === "prev" ? "‹" : "›"}
    </button>
  );

  return (
    <>
      {/* Boxed thumbnail — full content-column width */}
      <div className="w-full">
        <div className="relative overflow-hidden rounded-xl bg-canvas ring-1 ring-black/10">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={T.viewLarger}
            className="block w-full cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[i]}
              alt={alt(i)}
              className="block h-[460px] w-full select-none object-contain p-3"
            />
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[14px] font-semibold text-white">
              {T.enlarge}
            </span>
          </button>

          {n > 1 && (
            <>
              <ArrowBtn dir="prev" onClick={() => go(-1)} tone="light" />
              <ArrowBtn dir="next" onClick={() => go(1)} tone="light" />
              <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[14px] font-semibold text-white">
                {i + 1} / {n}
              </div>
            </>
          )}
        </div>

        {n > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {images.map((_, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setI(k)}
                aria-label={T.goTo(k)}
                className={`h-2.5 rounded-full transition-all ${
                  k === i ? "w-6 bg-ink-strong" : "w-2.5 bg-ink-strong/30 hover:bg-ink-strong/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={T.dialog}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={T.close}
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-[22px] font-bold text-white ring-1 ring-white/30 hover:bg-white/25"
          >
            ✕
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[i]}
            alt={alt(i)}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] select-none object-contain"
          />

          {n > 1 && (
            <>
              <ArrowBtn dir="prev" onClick={() => go(-1)} tone="dark" />
              <ArrowBtn dir="next" onClick={() => go(1)} tone="dark" />
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-[15px] font-semibold text-white ring-1 ring-white/30">
                {i + 1} / {n}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
