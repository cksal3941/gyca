import type { CSSProperties } from "react";
import { svgPath } from "blobs/v2";
import { ArrowRight } from "./icons";

// Soft organic blobs generated with the `blobs` library (fixed seeds →
// deterministic, so server and client render identically).
const BLOB_A = svgPath({ seed: "gyca-a", extraPoints: 6, randomness: 4, size: 200 });
const BLOB_B = svgPath({ seed: "gyca-b", extraPoints: 8, randomness: 6, size: 200 });
const BLOB_C = svgPath({ seed: "gyca-c", extraPoints: 7, randomness: 5, size: 200 });

function Blob({
  path,
  fill,
  className,
}: {
  path: string;
  fill: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <path fill={fill} d={path} />
    </svg>
  );
}

/** Even 8-spoke sparkle (original shape), tilted for a slight lean.
 *  A −45° turn is invisible on an 8-fold-symmetric mark, so we lean −22.5°. */
function Sparkle({ size = 44 }: { size?: number }) {
  const spokes = [0, 45, 90, 135];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        transform="translate(20 20) rotate(-22.5)"
      >
        {spokes.map((deg) => (
          <line key={deg} x1="0" y1="-15" x2="0" y2="15" transform={`rotate(${deg})`} />
        ))}
      </g>
    </svg>
  );
}

/** Circular stamp: "GLOBAL CREATIVE ARTS" on the top arc, "PLATFORM" on the
 *  bottom arc, with a blue sparkle in the middle. */
function StampBadge() {
  return (
    <div className="relative h-[152px] w-[152px]">
      <svg viewBox="0 0 120 120" className="h-full w-full text-ink-strong">
        <defs>
          {/* upper semicircle: text baseline sits on r=44, caps rise outward */}
          <path id="stamp-top" d="M16,60 A44,44 0 0 1 104,60" fill="none" />
          {/* lower semicircle: larger radius (r=51) so the bottom text sits the
              same distance from the border as the top text (caps rise inward) */}
          <path id="stamp-bottom" d="M9,60 A51,51 0 0 0 111,60" fill="none" />
        </defs>
        <circle
          cx="60"
          cy="60"
          r="58"
          fill="white"
          stroke="#000000"
          strokeWidth="0.8"
        />
        <text className="fill-current text-[11px] font-bold tracking-[0.02em] uppercase">
          <textPath href="#stamp-top" startOffset="50%" textAnchor="middle">
            Global Creative Arts
          </textPath>
        </text>
        <text className="fill-current text-[11px] font-bold tracking-[0.18em] uppercase">
          <textPath href="#stamp-bottom" startOffset="50%" textAnchor="middle">
            Platform
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-brand-blue">
        <Sparkle size={68} />
      </span>
    </div>
  );
}

/**
 * Collage tile. Layers the local image OVER a tone-matched gradient, so until
 * the real file is dropped in the gradient shows through (a failed image layer
 * is treated as none) instead of leaving the tile blank.
 */
function CollageTile({
  src,
  alt,
  tint,
  className = "",
  style,
}: {
  src: string;
  alt: string;
  tint: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`overflow-hidden bg-cover bg-center ring-1 ring-black/5 ${className}`}
      style={{ backgroundImage: `url(${src}), ${tint}`, ...style }}
      role="img"
      aria-label={alt}
    />
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-canvas">
      <div className="relative mx-auto grid max-w-shell items-center gap-10 px-6 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        {/* Left: copy */}
        <div>
          <p className="text-[18px] font-extrabold uppercase tracking-[0.12em] text-brand-blue">
            Global Creative Arts Platform
          </p>
          <h1 className="mt-5 text-[clamp(36px,4.2vw,52px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink-strong">
            Discover the Next Stage
            <br />
            for Your Creativity.
          </h1>
          <p className="mt-6 max-w-[31rem] text-[16px] leading-[1.6] text-ink-strong">
            Explore international awards, join preliminary rounds, and build a
            verified creative record—all through GYCA.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-lg bg-brand-blue px-6 py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Explore Awards
              <ArrowRight size={18} />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2.5 rounded-lg border border-ink-strong/15 bg-white px-6 py-3.5 text-[15px] font-semibold text-ink-strong transition-colors hover:border-brand-blue hover:text-brand-blue"
            >
              View Global Programs
              <ArrowRight size={18} />
            </a>
          </div>
        </div>

        {/* Right: geometric backdrop + image collage.
            All three tiles share one bottom baseline; only their heights differ.
            The whole group is nudged down with mt. */}
        <div className="relative mt-8 h-[420px] sm:h-[470px] lg:mt-12">
          {/* Organic pastel blobs behind the collage (free blob-generator SVGs) */}
          <Blob
            path={BLOB_A}
            fill="#e4e3fb"
            className="absolute -top-24 left-[16%] z-0 h-[500px] w-[500px]"
          />
          <Blob
            path={BLOB_B}
            fill="#ededf2"
            className="absolute left-[40%] top-[30px] z-0 h-[240px] w-[240px]"
          />
          <Blob
            path={BLOB_C}
            fill="#e9e8fb"
            className="absolute -bottom-28 -left-28 z-0 h-[360px] w-[360px]"
          />

          {/* Image cluster — bottom-aligned row, right-anchored.
              Cards 1 & 2 sit flush (flex, no gap → never overlap); card 3
              overlaps card 2 by a fixed margin, so resizing never brings the
              1–2 overlap back. */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-end">
            {/* Dancer (tallest) with the stamp anchored to its top-left corner */}
            <div className="relative shrink-0" style={{ width: 288, height: 380 }}>
              <CollageTile
                src="/images/hero/collage-dance.jpg"
                alt="Contemporary dance performance"
                tint="linear-gradient(135deg,#d0d0d6,#6c6c74)"
                className="h-full w-full rounded-[14px] rounded-br-none"
              />
              <div className="absolute -left-16 -top-14 z-30">
                <StampBadge />
              </div>
            </div>
            {/* Abstract paint — shortest, in front */}
            <CollageTile
              src="/images/hero/collage-paint.jpg"
              alt="Abstract painting detail"
              tint="linear-gradient(135deg,#a8dcd0,#f4c7cf 55%,#8fb6f0)"
              className="z-20 shrink-0 rounded-tr-[14px]"
              style={{ width: 216, height: 244 }}
            />
            {/* Piano — medium height, folded (rounded) top-right corner, overlaps paint */}
            <CollageTile
              src="/images/hero/collage-piano.jpg"
              alt="Pianist performing"
              tint="linear-gradient(135deg,#6b4326,#161616)"
              className="shrink-0"
              style={{
                width: 282,
                height: 321,
                marginLeft: -54,
                // 282×321 tile: rounded corners (r=14) + folded, rounded top-right
                clipPath:
                  'path("M 14 0 L 211 0 Q 225 0 234.9 9.9 L 272.1 47.1 Q 282 57 282 71 L 282 307 Q 282 321 268 321 L 14 321 Q 0 321 0 307 L 0 14 Q 0 0 14 0 Z")',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
