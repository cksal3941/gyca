type LogoProps = {
  className?: string;
  variant?: "light" | "dark";
};

// Pretendard wordmark (forced regardless of locale font swaps).
const PRETENDARD = "'Pretendard Variable', Pretendard, sans-serif";

/** GYCA emblem lockup: the emblem image + a two-line "GLOBAL YOUNG / CREATORS
 *  AWARD" wordmark, vertically centered to the emblem. `light` = white for dark
 *  backgrounds (header, footer); `dark` = full-color emblem + black wordmark for
 *  light backgrounds. The wordmark is hidden on narrow screens. */
export default function Logo({ className = "", variant = "dark" }: LogoProps) {
  const light = variant === "light";
  const src = light ? "/images/gyca-logo-white.png" : "/images/gyca_logo.png";
  const text = light ? "text-white" : "text-ink-strong";
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="GYCA — Global Young Creators Award" className="h-[44px] w-auto shrink-0" />
      <span
        className={`relative top-[3px] hidden flex-col text-left font-normal uppercase leading-[1.15] tracking-[0.04em] sm:flex ${text}`}
        style={{ fontFamily: PRETENDARD }}
      >
        <span className="text-[13px]">Global Young</span>
        <span className="text-[13px]">Creators Award</span>
      </span>
    </span>
  );
}
