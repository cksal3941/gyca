import type { Bi, Locale } from "@/lib/i18n";

// Partner ROLE labels only — actual institutions are shown after agreements are
// confirmed (per brief: don't display unconfirmed partners as official).
const PARTNERS: Bi[] = [
  { en: "Organizer", ko: "주최" },
  { en: "Venue", ko: "전시장" },
  { en: "Cultural Partner", ko: "문화 파트너" },
  { en: "Publishing Partner", ko: "출판 파트너" },
  { en: "Educational Partner", ko: "교육 파트너" },
  { en: "International Program", ko: "국제 프로그램" },
];

const CAPTION: Bi = {
  en: "Partners · to be announced",
  ko: "협력기관 · 확정 후 공개",
};

/** Partner role band scrolling infinitely (40s linear). */
export default function PartnerMarquee({ locale }: { locale: Locale }) {
  const labels = PARTNERS.map((p) => p[locale]);
  const sequence = [...labels, ...labels];
  return (
    <section className="marquee-paused bg-black pb-24 pt-4">
      <p className="mb-10 text-center text-[16px] font-medium text-white">
        {CAPTION[locale]}
      </p>
      <div className="overflow-hidden">
        <div className="flex w-max animate-logo-marquee items-center">
          {sequence.map((name, i) => (
            <span
              key={i}
              className="mx-10 whitespace-nowrap font-display text-[26px] uppercase tracking-wide text-neutral-300 transition-colors hover:text-white md:mx-14 md:text-[30px]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
