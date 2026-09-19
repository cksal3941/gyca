import { FINALISTS, pick, type Locale } from "@/lib/content/leipzig-home";

/** Section 5 · Finalists Go to Leipzig — what a finalist gains. Dark editorial
 *  block (myslide epilogue rhythm). Exhibition name/venue stays "planned" until
 *  local approval (brief §12); never assert an unapproved venue. */
export default function FinalistsLeipzig({ locale = "en" }: { locale?: Locale }) {
  const { exhibition } = FINALISTS;
  const isPending = exhibition.approvalStatus === "pending";

  return (
    <section className="bg-ink-strong text-white">
      <div className="mx-auto grid max-w-page gap-12 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
        <div>
          <h2 className="font-display text-[clamp(30px,4vw,52px)] font-extrabold uppercase leading-[1.02] tracking-[0.02em]">
            {pick(FINALISTS.title, locale)}
          </h2>
          <p className="mt-5 text-[18px] leading-[1.6] text-white">
            {pick(FINALISTS.lead, locale)}
          </p>

          <div className="mt-8 border border-white/25 p-5">
            <p className="text-[16px] font-semibold text-white">
              {pick(exhibition.plannedName, locale)}
            </p>
            {isPending && (
              <span className="mt-3 inline-flex items-center gap-2 border border-white/40 px-3 py-1 text-[16px] font-medium uppercase tracking-[0.08em] text-white">
                Pending approval · 승인 대기
              </span>
            )}
            <p className="mt-3 text-[16px] leading-[1.6] text-white/80">
              {pick(exhibition.venueNote, locale)}
            </p>
          </div>
        </div>

        <ul className="grid gap-px self-center overflow-hidden border border-white/20 bg-white/20 sm:grid-cols-2">
          {FINALISTS.gains.map((g) => (
            <li
              key={g.en}
              className="bg-ink-strong px-6 py-7 text-[18px] font-semibold text-white"
            >
              {pick(g, locale)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
