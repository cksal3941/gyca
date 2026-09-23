// PLACEHOLDER brand names — for DESIGN PREVIEW only. These are fictional and are
// NOT confirmed partners; replace with real institutions once agreements are
// signed (until then the safe copy was role labels + "to be announced").
const PARTNERS: string[] = [
  "GYCA",
  "Meridian Press",
  "Atlas Publishing",
  "Aurora Gallery",
  "Helios Foundation",
  "Nordic Arts Council",
  "Beacon Academy",
  "Vertex Studio",
  "Lumen Culture",
];

// Placeholder monochrome logo marks (inline SVG, no external assets). One mark
// per brand index so the same brand always shows the same mark. Design preview.
function Mark({ i }: { i: number }) {
  const marks = [
    <circle key="0" cx="16" cy="16" r="11" />,
    <rect key="1" x="7.5" y="7.5" width="17" height="17" transform="rotate(45 16 16)" />,
    <path key="2" d="M16 5 L27 26 L5 26 Z" strokeLinejoin="round" />,
    <path key="3" d="M16 4 L27 10 L27 22 L16 28 L5 22 L5 10 Z" strokeLinejoin="round" />,
    <g key="4">
      <circle cx="12" cy="16" r="8" />
      <circle cx="20" cy="16" r="8" />
    </g>,
    <g key="5">
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" stroke="none" />
    </g>,
    <path key="6" d="M16 5 V27 M5 16 H27" strokeLinecap="round" />,
    <path
      key="7"
      d="M16 4 Q17.5 14.5 28 16 Q17.5 17.5 16 28 Q14.5 17.5 4 16 Q14.5 14.5 16 4 Z"
      fill="currentColor"
      stroke="none"
    />,
    <g key="8">
      <circle cx="16" cy="16" r="11" />
      <path d="M5 16 H27" />
    </g>,
  ];
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 shrink-0 md:h-8 md:w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {marks[i % marks.length]}
    </svg>
  );
}

/** Partner logo band scrolling infinitely. */
// Repeat the labels enough times that each -50% "half" is wider than any
// viewport — otherwise the loop reveals an empty gap and looks broken. Duration
// scales with the copies so the scroll speed matches the original (2 copies/40s).
const COPIES = 6;

export default function PartnerMarquee() {
  const sequence = Array.from({ length: COPIES }, () => PARTNERS).flat();
  return (
    <section className="marquee-paused bg-black pb-24 pt-10">
      <div className="overflow-hidden">
        <div
          className="flex w-max animate-logo-marquee items-center"
          style={{ animationDuration: `${COPIES * 20}s` }}
        >
          {sequence.map((name, i) => (
            <span
              key={i}
              className="mx-10 flex shrink-0 items-center gap-3 whitespace-nowrap font-display text-[26px] uppercase tracking-wide text-white md:mx-14 md:text-[30px]"
            >
              <Mark i={i % PARTNERS.length} />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
