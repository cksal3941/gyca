import { Fragment } from "react";
import type { Metadata } from "next";
import PosterSlider from "@/components/site/PosterSlider";
import ContestTabs from "@/components/site/ContestTabs";
import { getServerLocale } from "@/lib/i18n/server";
import { SITE_URL } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";
import {
  DETAIL_META,
  KEY_FACTS,
  ABOUT,
  ELIGIBILITY,
  SUBMISSION,
  HOW_TO_APPLY,
  EVALUATION,
  OFFICIAL_SELECTION,
  SCHOLARSHIPS,
  FINALS_BENEFITS,
  VIENNA_EVENT,
  KEY_DATES,
  FEES,
  CONTACT,
  VIYBA_FORM_URL,
  VIYBA_PRELIM_DEADLINE_ISO,
  type I18n,
} from "@/lib/content/viyba-detail";

// Dedicated VIYBA 2026 detail. A static route segment, so it takes precedence
// over the generic /contests/[slug] page. Content mirrors the official
// competition guidelines; the Apply CTA points at the official online entry
// form (preliminary STEP 01), since entry is completed off-site.

function SectionH2({ ko, children }: { ko: boolean; children: React.ReactNode }) {
  return (
    <h2 className={`break-keep font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
      {children}
    </h2>
  );
}

/** Two-column label/value definition list used across several sections. */
function FactList({ rows, locale }: { rows: readonly { label: I18n; value: I18n }[]; locale: Locale }) {
  return (
    <dl className="mt-6 border-t border-line">
      {rows.map((r) => (
        <div key={r.label.en} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-b border-line py-4">
          <dt className="text-[16px] text-ink-strong">{r.label[locale]}</dt>
          <dd className="max-w-[34rem] text-right text-[16px] font-semibold text-ink-strong">{r.value[locale]}</dd>
        </div>
      ))}
    </dl>
  );
}

const CANONICAL_PATH = "/contests/viyba-2026";

export async function generateMetadata(): Promise<Metadata> {
  const locale: Locale = await getServerLocale();
  const title = DETAIL_META.title[locale];
  const description = DETAIL_META.summary[locale].replace(/\s*\n\s*/g, " ");
  const image = "/images/viyba-poster-1.png";
  return {
    title,
    description,
    keywords: [
      "VIYBA",
      "VIYBA 2026",
      "Vienna International Youth Book Awards",
      "비엔나 국제 청소년 북 어워드",
      "국제 청소년 북 어워드",
      "청소년 아트북 공모전",
      "youth book award",
      "art book competition",
      "GYCA",
    ],
    alternates: { canonical: CANONICAL_PATH },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}${CANONICAL_PATH}`,
      images: [{ url: image, width: 1024, height: 1536, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Event structured data — helps rich results + generative-engine answers. */
function viybaEventJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "VIYBA 2026 — Vienna International Youth Book Awards",
    description:
      "International youth book-arts competition for ages 7–18. Preliminary entry by 7 Nov 2026; the Vienna Final runs 14–16 Dec 2026.",
    startDate: "2026-12-14",
    endDate: "2026-12-16",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Music and Art, Vienna",
      address: { "@type": "PostalAddress", addressLocality: "Vienna", addressCountry: "AT" },
    },
    organizer: { "@type": "Organization", name: "GYCA (Global Young Creators Award)", url: SITE_URL },
    image: [`${SITE_URL}/images/viyba-poster-1.png`],
    url: `${SITE_URL}${CANONICAL_PATH}`,
    typicalAgeRange: "7-18",
    offers: {
      "@type": "Offer",
      name: "Preliminary entry (individual)",
      price: "150000",
      priceCurrency: "KRW",
      url: VIYBA_FORM_URL,
      availability: "https://schema.org/InStock",
      validThrough: "2026-11-07T23:00:00Z",
    },
  };
}

// Evaluated per request on the server; kept outside the component so render stays free of clock reads.
const isPreliminaryClosed = () => Date.now() >= new Date(VIYBA_PRELIM_DEADLINE_ISO).getTime();

export default async function ViybaDetailPage() {
  const locale: Locale = await getServerLocale();
  const ko = locale === "ko";
  const t = (v: I18n) => v[locale];

  // Past the preliminary deadline, the Apply CTA flips to a closed state.
  const prelimClosed = isPreliminaryClosed();
  const applyCta = (variant: "desktop" | "mobile") =>
    prelimClosed ? (
      <div
        className={`${variant === "desktop" ? "mt-5 " : ""}inline-flex h-12 w-full cursor-default items-center justify-center rounded-[7px] bg-neutral-300 px-6 text-[16px] font-bold text-ink-strong`}
      >
        {ko ? "예선 접수 마감" : "Entries closed"}
      </div>
    ) : (
      <a
        href={VIYBA_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${variant === "desktop" ? "mt-5 " : ""}inline-flex h-12 w-full items-center justify-center gap-2 rounded-[7px] bg-black px-6 text-[15px] font-semibold text-white hover:opacity-90`}
      >
        {ko ? "예선 접수하기" : "Apply (preliminary)"}
        <span aria-hidden>↗</span>
      </a>
    );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(viybaEventJsonLd()) }}
      />
      {/* No header band on contest detail pages — ~100px gap from the site nav. */}
      <section className="mx-auto max-w-page px-6 pt-[100px] pb-12 lg:pb-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="min-w-0">
            {/* Poster — small box, click to enlarge */}
            <PosterSlider
              locale={locale}
              images={["/images/viyba-poster-1.png", "/images/viyba-poster-2.png"]}
              labels={
                ko
                  ? ["VIYBA 2026 공모전 포스터", "VIYBA 2026 심사위원·시상 및 참가 안내"]
                  : ["VIYBA 2026 competition poster", "VIYBA 2026 jury · awards · entry guide"]
              }
            />

            {/* Title block (moved from the removed header band) — above the intro */}
            <div className="mt-10">
              <h1
                className={`mt-2 break-keep text-[38px] leading-tight text-ink-strong ${
                  ko ? "font-sans font-bold tracking-[-0.01em]" : "font-title font-bold tracking-[0.02em]"
                }`}
              >
                {t(DETAIL_META.title)}
              </h1>
              <p className="mt-3 whitespace-pre-line text-[16px] leading-[1.7] text-ink-strong">
                {t(DETAIL_META.summary)}
              </p>
              <p className="mt-4 text-[16px] text-ink-strong">
                {t(DETAIL_META.subtitle)} · {t(DETAIL_META.host)}
              </p>
            </div>

            {/* At-a-glance key facts — vertical list (label / value per row) */}
            <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
              {KEY_FACTS.rows.map((f) => (
                <Fragment key={f.label.en}>
                  <dt className="text-[16px] text-ink-strong">{t(f.label)}</dt>
                  <dd className="text-[16px] font-bold text-ink-strong">{t(f.value)}</dd>
                </Fragment>
              ))}
            </dl>

            {/* Tabbed sections — stage-based (overview → apply → selection → finals) */}
            <div className="mt-12">
              <ContestTabs
                tabs={[
                  {
                    id: "overview",
                    label: ko ? "공모전 안내" : "Overview",
                    content: (
                      <>
                        {/* About */}
                        <div id="about" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(ABOUT.title)}</SectionH2>
                          {ABOUT.paragraphs.map((p, i) => (
                            <p key={i} className="mt-4 text-[16px] leading-[1.9] text-ink-strong">
                              {t(p)}
                            </p>
                          ))}
                        </div>

                        {/* Eligibility & divisions */}
                        <div id="eligibility" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(ELIGIBILITY.title)}</SectionH2>
                          <p className="mt-4 text-[16px] leading-[1.8] text-ink-strong">
                            {t(ELIGIBILITY.ageNote)}
                          </p>
                          <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
                            {ELIGIBILITY.divisions.map((d) => (
                              <div key={d.name.en} className="bg-white px-5 py-6">
                                <p className="text-[14px] font-bold uppercase tracking-[0.1em] text-brand-blue">{t(d.name)}</p>
                                <p className="mt-2 text-[20px] font-bold text-ink-strong">{t(d.age)}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-4 text-[16px] leading-[1.8] text-ink-strong">{t(ELIGIBILITY.note)}</p>
                        </div>

                        {/* Entry categories (submission) */}
                        <div id="submission" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(SUBMISSION.title)}</SectionH2>
                          <p className="mt-4 text-[16px] leading-[1.9] text-ink-strong">
                            {t(SUBMISSION.intro)}
                          </p>
                          <dl className="mt-6 grid gap-px overflow-hidden border border-line bg-line">
                            {SUBMISSION.rows.map((r) => (
                              <div key={r.label.en} className="bg-white px-5 py-5">
                                <dt className="text-[14px] font-bold text-ink-strong">{t(r.label)}</dt>
                                <dd className="mt-1 text-[16px] leading-[1.7] text-ink-strong">{t(r.value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      </>
                    ),
                  },
                  {
                    id: "apply",
                    label: ko ? "접수 안내" : "How to enter",
                    content: (
                      <>
                        {/* Fees — brought to the front of the apply flow */}
                        <div id="fees" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(FEES.title)}</SectionH2>
                          <FactList rows={FEES.rows} locale={locale} />
                          <p className="mt-4 text-[16px] leading-[1.8] text-ink-strong">{t(FEES.note)}</p>
                        </div>

                        {/* How to apply */}
                        <div id="how-to-apply" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(HOW_TO_APPLY.title)}</SectionH2>
                          <p className="mt-4 text-[16px] leading-[1.9] text-ink-strong">
                            {t(HOW_TO_APPLY.intro)}
                          </p>
                          <ol className="mt-6 flex flex-col gap-4">
                            {HOW_TO_APPLY.steps.map((s) => (
                              <li key={s.name.en} className="border-l-4 border-brand-blue bg-canvas p-5">
                                <p className="text-[18px] font-bold text-ink-strong">{t(s.name)}</p>
                                <p className="mt-2 text-[16px] leading-[1.8] text-ink-strong">{t(s.note)}</p>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Schedule (merged key dates) */}
                        <div id="schedule" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(KEY_DATES.title)}</SectionH2>
                          <p className="mt-3 text-[16px] text-ink-strong">{t(KEY_DATES.timezoneNote)}</p>
                          <FactList rows={KEY_DATES.rows} locale={locale} />
                        </div>

                        {/* Application & contact */}
                        <div id="contact" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(CONTACT.title)}</SectionH2>
                          <FactList rows={CONTACT.rows} locale={locale} />
                          <div className="mt-6 flex justify-end">
                            <a
                              href={CONTACT.kakaoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-[7px] bg-[#FEE500] px-6 text-[16px] font-bold text-ink-strong hover:brightness-95"
                            >
                              {t(CONTACT.kakaoLabel)}
                              <span aria-hidden>↗</span>
                            </a>
                          </div>
                        </div>
                      </>
                    ),
                  },
                  {
                    id: "selection",
                    label: ko ? "예선 · 혜택" : "Selection & rewards",
                    content: (
                      <>
                        {/* Evaluation report */}
                        <div id="evaluation" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(EVALUATION.title)}</SectionH2>
                          <p className="mt-4 text-[16px] leading-[1.9] text-ink-strong">
                            {t(EVALUATION.intro)}
                          </p>
                          <div className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
                            {EVALUATION.criteria.map((c) => (
                              <div key={c.label.en} className="bg-white px-5 py-6">
                                <p className="text-[18px] font-bold text-ink-strong">{t(c.label)}</p>
                                <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">{t(c.note)}</p>
                              </div>
                            ))}
                          </div>
                          <p className="mt-4 text-[16px] leading-[1.8] text-ink-strong">{t(EVALUATION.note)}</p>
                        </div>

                        {/* Official Selection */}
                        <div id="official-selection" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(OFFICIAL_SELECTION.title)}</SectionH2>
                          <p className="mt-4 text-[16px] leading-[1.9] text-ink-strong">
                            {t(OFFICIAL_SELECTION.intro)}
                          </p>
                          <div className="mt-6 grid gap-6 sm:grid-cols-3">
                            {OFFICIAL_SELECTION.items.map((it, i) => (
                              <div key={it.label.en} className="border-t-2 border-brand-blue bg-canvas p-6">
                                <span className="text-[16px] font-bold text-brand-blue">{String(i + 1).padStart(2, "0")}</span>
                                <h3 className="mt-3 text-[18px] font-bold text-ink-strong">{t(it.label)}</h3>
                                <p className="mt-2 text-[16px] leading-[1.7] text-ink-strong">{t(it.value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Scholarships */}
                        <div id="scholarships" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(SCHOLARSHIPS.title)}</SectionH2>
                          <dl className="mt-6 border-t border-line">
                            {SCHOLARSHIPS.items.map((s) => (
                              <div key={s.rank.en} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4">
                                <dt className="text-[16px] font-semibold text-ink-strong">{t(s.rank)}</dt>
                                <dd className="text-[16px] text-ink-strong">{t(s.award)}</dd>
                              </div>
                            ))}
                          </dl>
                          <p className="mt-4 text-[16px] text-ink-strong">{t(SCHOLARSHIPS.note)}</p>
                        </div>
                      </>
                    ),
                  },
                  {
                    id: "finals",
                    label: ko ? "본선" : "Finals",
                    content: (
                      <>
                        {/* Finals benefits */}
                        <div id="finals" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(FINALS_BENEFITS.title)}</SectionH2>
                          <ul className="mt-6 flex flex-col gap-2.5">
                            {FINALS_BENEFITS.items.map((it) => (
                              <li key={it.en} className="flex items-start gap-2.5 text-[16px] leading-[1.7] text-ink-strong">
                                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                                {t(it)}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-4 text-[16px] text-ink-strong">{t(FINALS_BENEFITS.note)}</p>
                        </div>

                        {/* Vienna on-site event */}
                        <div id="vienna" className="scroll-mt-24">
                          <SectionH2 ko={ko}>{t(VIENNA_EVENT.title)}</SectionH2>
                          <FactList rows={VIENNA_EVENT.facts} locale={locale} />
                        </div>
                      </>
                    ),
                  },
                ]}
              />
            </div>
          </div>

          {/* Sticky CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-2xl border border-line bg-white p-6">
              <p className="text-[16px] text-ink-strong">{ko ? "예선 심사비" : "Preliminary fee"}</p>
              <p className="mt-1 font-title font-bold text-[26px] text-ink-strong">
                {ko ? "개인 150,000원" : "₩150,000 individual"}
              </p>
              <p className="mt-1 text-[16px] text-ink-strong">
                {ko ? "기관·단체 120,000원 / 1작품" : "₩120,000 group · per work"}
              </p>
              <p className="mt-3 text-[16px] text-ink-strong">
                {ko ? "예선 마감 2026.11.07 (CET)" : "Deadline 7 Nov 2026 (CET)"}
              </p>
              {applyCta("desktop")}
              <p className="mt-3 text-[15px] leading-[1.6] text-ink-strong">
                {ko
                  ? "온라인 신청 + 심사비 입금 + 실물 택배 도착이 모두 확인되어야 접수가 완료됩니다."
                  : "Entry is final only when the online form, fee payment, and physical arrival are all confirmed."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) */}
      <div className="sticky bottom-0 z-40 border-t border-line bg-white px-6 py-3 lg:hidden">
        {applyCta("mobile")}
      </div>
    </>
  );
}
