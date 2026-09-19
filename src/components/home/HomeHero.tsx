import Link from "next/link";
import { ArrowRight } from "@/components/landing/icons";
import { HERO, APPLY_HREF, DETAIL_HREF, pick, type Locale } from "@/lib/content/leipzig-home";

/**
 * Leipzig 2027 hero — text-forward editorial layout (myslide structural rhythm:
 * large display type, generous whitespace, single blue accent). No fabricated
 * event photography; a neutral typographic panel stands in until approved
 * imagery exists.
 */
export default function HomeHero({ locale = "en" }: { locale?: Locale }) {
  return (
    <section className="relative overflow-hidden bg-canvas">
      <div className="mx-auto grid max-w-page items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        {/* Left: copy */}
        <div>
          <p className="text-[18px] font-extrabold uppercase tracking-[0.18em] text-brand-blue">
            {HERO.brand}
          </p>
          <h1 className="mt-5 font-display text-[clamp(40px,6vw,76px)] font-extrabold uppercase leading-[0.98] tracking-[0.02em] text-ink-strong">
            {pick(HERO.headline, locale)}
          </h1>
          <p className="mt-6 text-[20px] font-semibold text-ink-strong">
            {pick(HERO.competition, locale)}
          </p>

          <span className="mt-4 inline-flex items-center gap-2 border border-brand-blue px-4 py-2 text-[16px] font-bold uppercase tracking-[0.08em] text-brand-blue">
            {pick(HERO.openCall, locale)}
          </span>

          {/* Two core promises only */}
          <ul className="mt-7 flex flex-col gap-2.5">
            {HERO.promises.map((p) => (
              <li key={p.en} className="flex items-center gap-2.5 text-[16px] text-ink-strong">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                {pick(p, locale)}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href={APPLY_HREF}
              className="inline-flex items-center gap-2.5 bg-ink-strong px-7 py-4 text-[16px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              {pick(HERO.primaryCta, locale)}
              <ArrowRight size={18} />
            </Link>
            <Link
              href={DETAIL_HREF}
              className="inline-flex items-center gap-2.5 border border-ink-strong/20 bg-white px-7 py-4 text-[16px] font-semibold text-ink-strong transition-colors hover:border-brand-blue hover:text-brand-blue"
            >
              {pick(HERO.secondaryCta, locale)}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        {/* Right: typographic panel (placeholder for approved imagery) */}
        <div className="relative hidden aspect-[4/5] w-full overflow-hidden lg:block">
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(150deg,#0b05e2 0%,#1b1b3a 55%,#111111 100%)" }}
          />
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white">
            <span className="text-[16px] font-bold uppercase tracking-[0.22em] text-white/80">
              Leipzig 2027
            </span>
            <span className="font-display text-[clamp(56px,7vw,104px)] font-extrabold uppercase leading-[0.9]">
              Art
              <br />
              Book
            </span>
            <span className="text-[16px] text-white/80">
              {pick(HERO.competition, locale)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
