import { Fragment } from "react";
import { JOURNEY, pick, type Locale } from "@/lib/content/leipzig-home";
import { ArrowRight } from "@/components/landing/icons";

/** Section 3 · Journey — Entry → Official Selection → Leipzig Finalist → Global Stage.
 *  One line per step. */
export default function Journey({ locale = "en" }: { locale?: Locale }) {
  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-page px-6 py-20">
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
          {pick(JOURNEY.title, locale)}
        </h2>

        <div className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:flex xl:items-stretch xl:justify-between xl:gap-0">
          {JOURNEY.steps.map((step, i) => (
            <Fragment key={step.key}>
              <div className="flex-1 border-t-2 border-brand-blue bg-white p-6 xl:mx-0">
                <span className="text-[16px] font-bold text-brand-blue">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-[20px] font-bold text-ink-strong">
                  {pick(step.label, locale)}
                </h3>
                <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">
                  {pick(step.note, locale)}
                </p>
              </div>
              {i < JOURNEY.steps.length - 1 && (
                <div className="hidden items-center px-4 text-ink-strong xl:flex">
                  <ArrowRight size={20} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
