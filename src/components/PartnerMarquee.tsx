const PARTNERS = [
  "복지재단",
  "KOREAN AIR",
  "Sarahba",
  "GSEF FOUNDATION",
  "호미화방",
  "드림디포",
];

/** "함께한 기업" — partner logo band scrolling infinitely (40s linear). */
export default function PartnerMarquee() {
  const sequence = [...PARTNERS, ...PARTNERS];
  return (
    <section className="marquee-paused bg-black pb-24 pt-4">
      <p className="mb-10 text-center text-[16px] font-medium text-white">
        함께한 기업
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
