import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { getServerLocale } from "@/lib/i18n/server";
import { getCompetitionBySlug, canStartEntry } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import {
  DETAIL_META,
  CORE,
  DIVISIONS,
  SUBMISSION,
  JUDGING,
  SELECTION,
  CERTIFICATES,
  EXHIBITION,
  FAQ,
  KEY_DATES,
  LEIPZIG_SLUG,
  type I18n,
  type Maybe,
} from "@/lib/content/leipzig-detail";

// Dedicated Leipzig 2027 detail. A static route segment, so it takes precedence
// over the generic /contests/[slug] page. First-launch content is DOCX-structured
// and marks any undecided policy as "준비 중" rather than inventing it.

const APPLY_HREF = `/submit?contest=${LEIPZIG_SLUG}`;

/** Render a confirmed value, or a clearly-marked "being finalized" chip. */
function MaybeValue({ v, locale }: { v: Maybe; locale: Locale }) {
  if (v.pending) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-field bg-canvas px-3 py-1 text-[15px] font-medium text-ink-strong">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        {locale === "ko" ? "준비 중" : "Being finalized"}
      </span>
    );
  }
  return <span className="font-semibold text-ink-strong">{v.value[locale]}</span>;
}

function SectionH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-title font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
      {children}
    </h2>
  );
}

export default async function LeipzigDetailPage() {
  const locale: Locale = await getServerLocale();
  const ko = locale === "ko";
  const t = (v: I18n) => v[locale];

  // Apply CTA is gated strictly on the server competition's allowedActions
  // (start_entry). Live: GET /competitions/leipzig-2027; a lookup failure or a
  // not-yet-open policy simply falls to the "준비 중" state — never a fake Apply.
  const comp = await getCompetitionBySlug(LEIPZIG_SLUG);
  const canApply = comp.kind === "success" && canStartEntry(comp.data);

  return (
    <>
      <EditorialHeader
        eyebrow={t(DETAIL_META.eyebrow)}
        title={t(DETAIL_META.title)}
        description={t(DETAIL_META.summary)}
        crumbs={[
          { label: ko ? "공모전" : "Competitions", href: "/contests" },
          { label: ko ? "라이프치히 2027" : "Leipzig 2027" },
        ]}
        locale={locale}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[16px] font-semibold text-ink-strong">
            <span className="h-2 w-2 rounded-full bg-success" />
            {ko ? "접수 중" : "Open call"}
          </span>
        }
      />

      {/* Typographic hero band (no fabricated event photography) */}
      <div className="mx-auto max-w-page px-6 pt-10 lg:pt-14">
        <div className="relative aspect-[21/9] w-full overflow-hidden ring-1 ring-black/5">
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg,#0b05e2 0%,#1b1b3a 55%,#111111 100%)" }}
          />
          <div className="absolute inset-0 flex flex-col justify-between p-8 text-white sm:p-12">
            <span className="text-[16px] font-bold uppercase tracking-[0.22em] text-white/80">
              Leipzig 2027
            </span>
            <span className="font-display text-[clamp(40px,7vw,96px)] font-extrabold uppercase leading-[0.9]">
              Art Book
              <br />
              Awards
            </span>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-page px-6 py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="min-w-0">
            {/* Core information + fee */}
            <div id="core" className="scroll-mt-24">
              <SectionH2>{t(CORE.title)}</SectionH2>
              <dl className="mt-6 border-t border-line">
                {CORE.facts.map((f) => (
                  <div
                    key={f.label.en}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4"
                  >
                    <dt className="text-[16px] text-ink-strong">{t(f.label)}</dt>
                    <dd className="text-[16px]">
                      <MaybeValue v={f.value} locale={locale} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 max-w-[42rem] text-[16px] leading-[1.8] text-ink-strong">
                {t(CORE.feeNote)}
              </p>
            </div>

            {/* Divisions & categories */}
            <div id="divisions" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(DIVISIONS.title)}</SectionH2>
              <p className="mt-4 max-w-[42rem] text-[16px] leading-[1.9] text-ink-strong">
                {t(DIVISIONS.intro)}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="border border-brand-blue px-4 py-2 text-[16px] font-semibold text-brand-blue">
                  {t(DIVISIONS.category)}
                </span>
                <span className="text-[16px] text-ink-strong">·</span>
                <span className="inline-flex items-center gap-2 text-[16px] text-ink-strong">
                  {ko ? "연령 그룹" : "Age groups"}:{" "}
                  <MaybeValue v={DIVISIONS.ageBrackets} locale={locale} />
                </span>
              </div>
              <p className="mt-3 text-[16px] text-ink-strong">{t(DIVISIONS.ageBracketsNote)}</p>
            </div>

            {/* Submission & required materials */}
            <div id="submission" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(SUBMISSION.title)}</SectionH2>
              <dl className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
                {SUBMISSION.specs.map((s) => (
                  <div key={s.label.en} className="bg-white px-5 py-5">
                    <dt className="text-[16px] text-ink-strong">{t(s.label)}</dt>
                    <dd className="mt-1 text-[16px]">
                      <MaybeValue v={s.value} locale={locale} />
                    </dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-8 text-[18px] font-bold text-ink-strong">
                {t(SUBMISSION.materials.title)}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {SUBMISSION.materials.items.map((m) => (
                  <li key={m.en} className="flex items-center gap-2.5 text-[16px] text-ink-strong">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                    {t(m)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Judging criteria */}
            <div id="judging" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(JUDGING.title)}</SectionH2>
              <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
                {JUDGING.criteria.map((c) => (
                  <div key={c.label.en} className="bg-white px-5 py-6">
                    <p className="text-[18px] font-bold text-ink-strong">{t(c.label)}</p>
                    <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">{t(c.note)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[16px] text-ink-strong">{t(JUDGING.reviewNote)}</p>
            </div>

            {/* Schedule */}
            <div id="schedule" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{ko ? "일정" : "Schedule"}</SectionH2>
              <p className="mt-3 text-[16px] text-ink-strong">{t(KEY_DATES.timezoneNote)}</p>
              <dl className="mt-6 border-t border-line">
                {KEY_DATES.rows.map((row) => (
                  <div
                    key={row.label.en}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4"
                  >
                    <dt className="text-[16px] font-semibold text-ink-strong">{t(row.label)}</dt>
                    <dd className="text-[16px] text-ink-strong">{t(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Official Selection & Finalist */}
            <div id="selection" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(SELECTION.title)}</SectionH2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {SELECTION.stages.map((s, i) => (
                  <div key={s.key} className="border-t-2 border-brand-blue bg-canvas p-6">
                    <span className="text-[16px] font-bold text-brand-blue">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-3 text-[20px] font-bold text-ink-strong">{t(s.name)}</h3>
                    <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">{t(s.note)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Certificates */}
            <div id="certificates" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(CERTIFICATES.title)}</SectionH2>
              <p className="mt-3 text-[16px] text-ink-strong">{t(CERTIFICATES.intro)}</p>
              <dl className="mt-6 border-t border-line">
                {CERTIFICATES.items.map((c) => (
                  <div
                    key={c.name.en}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4"
                  >
                    <dt className="text-[16px] font-semibold text-ink-strong">{t(c.name)}</dt>
                    <dd className="text-[16px] text-ink-strong">{t(c.when)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Exhibition support & costs */}
            <div id="exhibition" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(EXHIBITION.title)}</SectionH2>

              {/* Planned/pending exhibition — never asserts an approved venue */}
              <div className="mt-6 border border-line p-5">
                <p className="text-[16px] font-semibold text-ink-strong">
                  {t(EXHIBITION.plannedName)}
                </p>
                {EXHIBITION.approvalStatus === "pending" && (
                  <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-field bg-canvas px-3 py-1 text-[15px] font-medium text-ink-strong">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    {ko ? "현지 승인 대기" : "Pending local approval"}
                  </span>
                )}
                <p className="mt-3 text-[16px] leading-[1.7] text-ink-strong">
                  {t(EXHIBITION.venueNote)}
                </p>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="bg-canvas p-6">
                  <h3 className="text-[18px] font-bold text-ink-strong">
                    {t(EXHIBITION.provided.title)}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {EXHIBITION.provided.items.map((it) => (
                      <li key={it.en} className="flex items-center gap-2.5 text-[16px] text-ink-strong">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                        {t(it)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border border-line p-6">
                  <h3 className="text-[18px] font-bold text-ink-strong">
                    {t(EXHIBITION.selfCost.title)}
                  </h3>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {EXHIBITION.selfCost.items.map((it) => (
                      <li key={it.en} className="flex items-center gap-2.5 text-[16px] text-ink-strong">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-field" />
                        {t(it)}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 flex items-center gap-2 text-[16px] text-ink-strong">
                    {ko ? "금액" : "Amount"}:{" "}
                    <MaybeValue v={EXHIBITION.selfCost.amount} locale={locale} />
                  </p>
                </div>
              </div>

              {/* The €70 / finalist-cost boundary, stated plainly */}
              <div className="mt-6 border-l-4 border-brand-blue bg-canvas px-5 py-4">
                <p className="text-[16px] font-semibold leading-[1.8] text-ink-strong">
                  {t(EXHIBITION.boundaryNote)}
                </p>
              </div>
            </div>

            {/* FAQ + terms */}
            <div id="faq" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2>{t(FAQ.title)}</SectionH2>
              <dl className="mt-6 divide-y divide-line border-y border-line">
                {FAQ.items.map((f) => (
                  <div key={f.q.en} className="py-6">
                    <dt className="text-[18px] font-bold text-ink-strong">{t(f.q)}</dt>
                    <dd className="mt-2 max-w-[42rem] text-[16px] leading-[1.9] text-ink-strong">
                      {t(f.a)}
                    </dd>
                  </div>
                ))}
              </dl>
              {FAQ.termsReady ? null : (
                <p className="mt-4 text-[16px] text-ink-strong">{t(FAQ.termsPendingNote)}</p>
              )}
            </div>
          </div>

          {/* Sticky CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-2xl border border-line bg-white p-6">
              <p className="text-[16px] text-ink-strong">{ko ? "출품비" : "Entry fee"}</p>
              <p className="mt-1 font-title font-bold text-[28px] text-ink-strong">€70</p>
              <p className="mt-1 text-[16px] text-ink-strong">
                {ko ? "마감 2026.12.31" : "Deadline 31 Dec 2026"}
              </p>
              {canApply ? (
                <Link
                  href={APPLY_HREF}
                  className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90"
                >
                  {ko ? "작품 접수하기" : "Apply now"}
                  <span aria-hidden>›</span>
                </Link>
              ) : (
                <span className="mt-5 flex cursor-not-allowed items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 text-[16px] font-semibold text-ink-strong opacity-70">
                  {ko ? "접수 준비 중" : "Opening soon"}
                </span>
              )}
              <p className="mt-3 text-[15px] leading-[1.6] text-ink-strong">
                {ko
                  ? "접수 시 결제는 €70뿐입니다. 본선 비용은 별도·선정 후 안내됩니다."
                  : "Only €70 is charged at entry. Finalist costs are separate and announced after selection."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) */}
      <div className="sticky bottom-0 z-40 border-t border-line bg-white px-6 py-3 lg:hidden">
        {canApply ? (
          <Link
            href={APPLY_HREF}
            className="flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white"
          >
            {ko ? "작품 접수하기 · €70" : "Apply now · €70"}
            <span aria-hidden>›</span>
          </Link>
        ) : (
          <span className="flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 text-[16px] font-semibold text-ink-strong">
            {ko ? "접수 준비 중" : "Opening soon"}
          </span>
        )}
      </div>
    </>
  );
}
