import { ArrowRight, Asterisk } from "./icons";

/** Rotating stamp badge: curved text around an 8-point star. */
function StampBadge() {
  return (
    <div className="absolute -top-2 left-0 z-20 h-[112px] w-[112px] lg:-left-6">
      <svg viewBox="0 0 120 120" className="h-full w-full text-ink-strong">
        <defs>
          <path
            id="stamp-arc"
            d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"
          />
        </defs>
        <circle
          cx="60"
          cy="60"
          r="58"
          fill="white"
          stroke="currentColor"
          strokeOpacity="0.12"
        />
        <text className="fill-current text-[9px] font-semibold tracking-[0.22em] uppercase">
          <textPath href="#stamp-arc" startOffset="0">
            Global Creative Arts · Platform ·
          </textPath>
        </text>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-brand-blue">
        <Asterisk size={22} />
      </span>
    </div>
  );
}

/** Placeholder tile that shows a local image if present, else a soft surface. */
function CollageTile({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-surface bg-cover bg-center shadow-[0_20px_50px_-20px_rgba(17,17,17,0.35)] ring-1 ring-black/5 ${className}`}
      style={{ backgroundImage: `url(${src})` }}
      role="img"
      aria-label={alt}
    />
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-canvas">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-24 top-10 h-[420px] w-[420px] rounded-full bg-brand-purple/15 blur-3xl" />
      <div className="pointer-events-none absolute right-40 bottom-0 h-[260px] w-[260px] rounded-full bg-brand-teal/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-shell items-center gap-12 px-6 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        {/* Left: copy */}
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
            Global Creative Arts Platform
          </p>
          <h1 className="mt-5 text-[clamp(34px,4vw,50px)] font-extrabold leading-[1.06] tracking-[-0.02em] text-ink-strong">
            Discover the Next Stage
            <br />
            for Your Creativity.
          </h1>
          <p className="mt-6 max-w-[30rem] text-[16px] leading-[1.6] text-neutral-500">
            Explore international awards, join preliminary rounds, and build a
            verified creative record—all through GYCA.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full bg-brand-blue px-6 py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Explore Awards
              <ArrowRight size={18} />
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-ink-strong/20 bg-white px-6 py-3.5 text-[15px] font-semibold text-ink-strong transition-colors hover:border-brand-blue hover:text-brand-blue"
            >
              View Global Programs
              <ArrowRight size={18} />
            </a>
          </div>
        </div>

        {/* Right: stamp + image collage */}
        <div className="relative h-[360px] sm:h-[420px]">
          <StampBadge />
          <CollageTile
            src="/images/hero/collage-dance.jpg"
            alt="Contemporary dance performance"
            className="absolute left-10 top-4 h-[300px] w-[46%]"
          />
          <CollageTile
            src="/images/hero/collage-paint.jpg"
            alt="Abstract painting detail"
            className="absolute left-[42%] top-24 z-10 h-[180px] w-[34%]"
          />
          <CollageTile
            src="/images/hero/collage-piano.jpg"
            alt="Pianist performing"
            className="absolute right-0 top-10 h-[260px] w-[40%]"
          />
        </div>
      </div>
    </section>
  );
}
