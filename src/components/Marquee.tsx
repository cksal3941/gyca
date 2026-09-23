// Scrolling headline band — always English (the Bebas display face is Latin,
// and the marquee reads as a graphic element regardless of the site locale).
const PHRASES = [
  "Your Book. Your Story. Next Stop, Leipzig.",
  "GYCA International Youth Art Book Awards",
];

export default function Marquee() {
  // Duplicate the sequence so the -50% loop is seamless.
  const sequence = [...PHRASES, ...PHRASES];
  return (
    <section className="marquee-paused overflow-hidden bg-white py-10 md:py-14">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {sequence.map((phrase, i) => (
          <span
            key={i}
            className="font-display text-[40px] uppercase tracking-[1px] text-ink-strong sm:text-[64px] md:text-[88px]"
          >
            {phrase}
            {/* Even gap on both sides so every bullet is equally spaced */}
            <span className="mx-8 align-middle text-[0.4em] text-ink-strong md:mx-12">
              ●
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
