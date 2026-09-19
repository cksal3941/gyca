import Link from "next/link";
import { FEE_SPEC, DETAIL_HREF, pick, type Locale } from "@/lib/content/leipzig-home";
import { ArrowRight } from "@/components/landing/icons";

/** Section 5 · Fee & submission-spec summary. Summary only (full spec on the
 *  Leipzig detail page). The €70 entry fee is shown clearly separate from any
 *  finalist-stage cost. */
export default function FeeSpecSummary({ locale = "en" }: { locale?: Locale }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-page px-6 py-20">
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
          {pick(FEE_SPEC.title, locale)}
        </h2>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
          {/* Fee */}
          <div className="border-t-2 border-brand-blue bg-canvas p-8">
            <p className="text-[16px] font-medium text-ink-strong">
              {pick(FEE_SPEC.feeLabel, locale)}
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[clamp(44px,6vw,64px)] font-extrabold leading-none text-ink-strong">
                {pick(FEE_SPEC.fee, locale)}
              </span>
              <span className="text-[18px] font-semibold text-ink-strong">
                {pick(FEE_SPEC.feeUnit, locale)}
              </span>
            </p>
            <p className="mt-5 text-[16px] leading-[1.7] text-ink-strong">
              {pick(FEE_SPEC.costSeparationNote, locale)}
            </p>
          </div>

          {/* Spec chips + CTA */}
          <div>
            <dl className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
              {FEE_SPEC.specs.map((s) => (
                <div key={s.label.en} className="bg-white px-6 py-6">
                  <dt className="text-[16px] text-ink-strong">{pick(s.label, locale)}</dt>
                  <dd className="mt-1 text-[18px] font-semibold text-ink-strong">
                    {pick(s.value, locale)}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href={DETAIL_HREF}
              className="mt-6 inline-flex items-center gap-2.5 text-[16px] font-semibold text-brand-blue hover:gap-3.5"
            >
              {pick(FEE_SPEC.detailCta, locale)}
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
