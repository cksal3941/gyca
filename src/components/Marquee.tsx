import type { BiLines, Locale } from "@/lib/i18n";

const PHRASES: BiLines = {
  en: [
    "Your Book. Your Story. Next Stop, Leipzig.",
    "GYCA International Youth Art Book Awards",
  ],
  ko: [
    "당신의 책, 당신의 이야기. 다음 무대는 라이프치히.",
    "GYCA 국제 청소년 아트북 어워드",
  ],
};

/** Scrolling headline band. */
export default function Marquee({ locale }: { locale: Locale }) {
  // Duplicate the sequence so the -50% loop is seamless.
  const phrases = PHRASES[locale];
  const sequence = [...phrases, ...phrases];
  return (
    <section className="marquee-paused overflow-hidden border-y border-line bg-white py-10 md:py-14">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {sequence.map((phrase, i) => (
          <span
            key={i}
            className="mx-8 font-display text-[40px] uppercase tracking-[1px] text-neutral-200 sm:text-[64px] md:mx-12 md:text-[88px]"
          >
            {phrase}
            <span className="mx-8 align-middle text-[0.4em] text-brand-blue/40 md:mx-12">
              ●
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
