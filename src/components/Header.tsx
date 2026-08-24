"use client";

import { useEffect, useState } from "react";
import Logo from "./Logo";

const MENU = [
  "자사 소개",
  "북스토어",
  "새 소식",
  "주최 대회",
  "에필로그",
  "수상작",
  "협업 갤러리",
  "제휴 문의",
];

// The reference uses the simple-line-icons webfont (icon-social-instagram /
// icon-globe). Render the same glyphs so the icons match exactly.
function Icon({ name, size }: { name: string; size: number }) {
  return (
    <i
      className={`icon-${name} block leading-none`}
      style={{ fontSize: size }}
      aria-hidden
    />
  );
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      // Hysteresis: enter at 90px, leave at 40px — avoids rapid toggling
      // (flicker) when the scroll position hovers near a single threshold.
      setScrolled((prev) => (prev ? y > 40 : y > 90));
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Default: white bg + dark text + black lines. Scrolled: black bg + white text + white lines.
  const line = scrolled ? "border-white" : "border-black";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] border-b-2 ${line} ${
        scrolled ? "bg-black text-white" : "bg-white text-ink"
      }`}
    >
      <div className="mx-auto flex h-[70px] max-w-[1570px] items-stretch">
        {/* Logo zone — sits at the container's left edge (no padding), matching
            the reference's symmetric ~167px inset. */}
        <a
          href="#top"
          className={`flex w-[150px] shrink-0 items-center pl-4 !transition-none sm:w-[190px] lg:w-[214px] lg:border-r-2 lg:pl-0 ${line}`}
        >
          <Logo variant={scrolled ? "light" : "dark"} />
        </a>

        {/* Menu zone — right-aligned (menu hugs the icons side, gap sits between
            logo and menu). Each item padded 30px left/right, items touch. */}
        <nav
          className={`hidden flex-1 items-center justify-end lg:flex lg:border-r-2 ${line}`}
        >
          {MENU.map((item) => (
            <a
              key={item}
              href="#"
              className="flex h-full items-center px-[30px] font-nav text-[17px] font-normal whitespace-nowrap !transition-none hover:text-brand-blue"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Icons zone — sits at the container's right edge (no padding), with
            instagram ~26px after the divider. Both icons share a 10px-padded
            box (no border/background) so they read as a uniform icon set. */}
        <div className="ml-auto flex shrink-0 items-center pl-4 pr-4 lg:ml-0 lg:pl-[26px] lg:pr-0">
          {/* Instagram: 39×39 box (10px padding, 19px glyph) */}
          <a
            href="#"
            aria-label="Instagram"
            className="inline-flex items-center justify-center p-[10px] !transition-none hover:text-brand-blue"
          >
            <Icon name="social-instagram" size={19} />
          </a>
          <button className="hidden items-center !transition-none hover:text-brand-blue sm:flex">
            {/* Globe: matching 38×38 box (10px padding, 18px glyph) */}
            <span className="inline-flex items-center justify-center p-[10px]">
              <Icon name="globe" size={18} />
            </span>
            <span className="font-nav text-[17px]">한국어</span>
            {/* Dropdown caret: CSS triangle (8×4, points down) in currentColor,
                matching the reference border-triangle. */}
            <span
              aria-hidden
              className="ml-[5px]"
              style={{
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "4px solid currentColor",
              }}
            />
          </button>

          {/* Hamburger */}
          <button
            className="flex flex-col gap-[5px] p-2 !transition-none lg:hidden"
            aria-label="메뉴 열기"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
          </button>
        </div>
      </div>

      {/* Mobile slide menu */}
      {mobileOpen && (
        <div className="border-t-2 border-current bg-white text-ink lg:hidden">
          <nav className="flex flex-col px-6 py-2">
            {MENU.map((item) => (
              <a
                key={item}
                href="#"
                className="border-b border-line py-3 font-nav text-[16px] hover:text-brand-blue"
              >
                {item}
              </a>
            ))}
            <div className="flex items-center gap-4 py-3 text-neutral-600">
              <Icon name="social-instagram" size={19} />
              <span className="flex items-center gap-1.5 font-nav text-[13px]">
                <Icon name="globe" size={18} /> 한국어
              </span>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
