const PHRASES = [
  "Young Artists Begin and Grow",
  "A Place Where Young Artists Begin and Grow",
];

/** Scrolling headline band ("YOUNG ARTISTS BEGIN AND GROW"). */
export default function Marquee() {
  // Duplicate the sequence so the -50% loop is seamless.
  const sequence = [...PHRASES, ...PHRASES];
  return (
    <section className="marquee-paused overflow-hidden border-y border-line bg-white py-10 md:py-14">
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {sequence.map((phrase, i) => (
          <span
            key={i}
            className="mx-8 font-display text-[40px] uppercase tracking-[-1px] text-neutral-200 sm:text-[64px] md:mx-12 md:text-[88px]"
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
