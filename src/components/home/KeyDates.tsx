import { KEY_DATES, pick, type Locale } from "@/lib/content/leipzig-home";

/** Section 4 · Key Dates — dates only, no repeated benefit copy.
 *  Exact deadline enforcement is server-authoritative; labels here are display copy. */
export default function KeyDates({ locale = "en" }: { locale?: Locale }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-page px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
            {pick(KEY_DATES.title, locale)}
          </h2>
          <p className="text-[16px] text-ink-strong">
            {pick(KEY_DATES.timezoneNote, locale)}
          </p>
        </div>

        <dl className="mt-10 border-t border-line">
          {KEY_DATES.rows.map((row) => (
            <div
              key={row.label.en}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-5"
            >
              <dt className="text-[18px] font-semibold text-ink-strong">
                {pick(row.label, locale)}
              </dt>
              <dd className="text-[18px] text-ink-strong">
                {pick(row.value, locale)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
