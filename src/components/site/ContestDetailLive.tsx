"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  getCompetitionBySlug,
  listCompetitionCards,
  canStartEntry,
  canViewGuidelines,
  type CompetitionCard,
} from "@/lib/api";
import { money, fmtDate } from "@/lib/entry-view";
import { STATUS_LABEL, STATUS_COLOR, type ContestStatus } from "@/lib/site-data";
import type { Competition } from "@/contracts";
import type { Locale } from "@/lib/i18n";

type KeyDateValue = Competition["keyDates"][number]["value"];

// Contest detail (LIVE ONLY). Client component so the /competitions/{slug} +
// /content/competition-cards fetches carry the session — a server component
// cannot forward the cookie (relative URL + same-origin credentials). The mock
// path stays in the [slug] server page; this renders REAL server data only
// (competition + optional presentation copy), never placeholder spec sections.

type Presentation = CompetitionCard["presentation"];
type Phase = "loading" | "notfound" | "error" | "ready";

// "archived" has no contest badge vocabulary — render it as closed (same as list).
function badgeStatus(c: Competition): ContestStatus {
  return c.status === "archived" ? "closed" : c.status;
}

function fmtKeyDate(v: KeyDateValue, ko: boolean): string {
  if (!v) return ko ? "미정" : "TBD";
  if (v.kind === "date") return fmtDate(v.date, ko);
  if (v.kind === "instant") return fmtDate(v.at, ko);
  return `${fmtDate(v.startsOn, ko)} – ${fmtDate(v.endsOn, ko)}`;
}

const NEUTRAL_TINT = "linear-gradient(135deg,#e8edf5,#cdd7e6)";

export default function ContestDetailLive({ slug }: { slug: string }) {
  const { locale }: { locale: Locale } = useLocale();
  const ko = locale === "ko";
  const [comp, setComp] = useState<Competition | null>(null);
  const [pres, setPres] = useState<Presentation | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  // Loading is the initial state and is re-armed by retry — never set
  // synchronously in the effect body (avoids cascading renders).
  const retry = () => {
    setComp(null);
    setPres(null);
    setPhase("loading");
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getCompetitionBySlug(slug);
      if (!alive) return;
      if (res.kind !== "success") {
        setPhase(res.kind === "error" && res.code !== "NOT_FOUND" ? "error" : "notfound");
        return;
      }
      setComp(res.data);
      setPhase("ready");
      // Presentation copy is best-effort decoration; a failure here must not
      // block the detail. Match the card by slug (the list is small).
      const cards = await listCompetitionCards({ limit: 50 });
      if (!alive) return;
      if (cards.kind === "success") {
        const card = cards.data.items.find((c) => c.competition.slug === slug);
        if (card) setPres(card.presentation);
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug, reloadKey]);

  if (phase === "loading") {
    return (
      <section className="mx-auto max-w-page px-6 py-16">
        <div className="mx-auto h-64 max-w-page animate-pulse rounded-2xl border border-line bg-surface" />
      </section>
    );
  }

  if (phase === "error") {
    return (
      <section className="mx-auto max-w-page px-6 py-16">
        <div className="mx-auto max-w-[46rem]">
          <p className="text-[16px] text-ink-strong">
            {ko
              ? "공모전을 불러오지 못했습니다. 잠시 후 다시 시도하세요."
              : "Could not load the competition. Please try again shortly."}
          </p>
          <button
            onClick={retry}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-black bg-white px-5 py-3 text-[16px] font-semibold text-ink hover:bg-neutral-50"
          >
            {ko ? "다시 시도" : "Retry"}
          </button>
        </div>
      </section>
    );
  }

  if (phase === "notfound" || !comp) {
    return (
      <section className="mx-auto max-w-page px-6 py-16">
        <div className="mx-auto max-w-[46rem]">
          <p className="text-[16px] text-ink-strong">
            {ko ? "공모전을 찾을 수 없습니다." : "Competition not found."}
          </p>
          <Link
            href="/contests"
            className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            <span aria-hidden>‹</span>
            {ko ? "공모전 목록으로" : "Back to competitions"}
          </Link>
        </div>
      </section>
    );
  }

  const st = badgeStatus(comp);
  const category = pres?.category ? pres.category[locale] : undefined;
  const summary = pres?.summary ? pres.summary[locale] : undefined;
  const city = pres?.city ? pres.city[locale] : null;
  const cover = pres?.cover ? pres.cover.src : null;

  const period =
    comp.opensAt && comp.submissionClosesAtExclusive
      ? `${fmtDate(comp.opensAt, ko)} – ${fmtDate(comp.submissionClosesAtExclusive, ko)}`
      : null;

  // Key facts — only rows with real data.
  const facts: [string, string][] = [];
  if (city) facts.push([ko ? "도시" : "City", city]);
  if (period) facts.push([ko ? "접수 기간" : "Entry period", period]);
  if (comp.fee) facts.push([ko ? "참가비" : "Entry fee", money(comp.fee.amountMinor)]);

  const categories = comp.formSpec?.categories ?? [];
  const ageGroups = comp.formSpec?.ageGroups ?? [];
  const uploads = comp.formSpec?.uploads ?? [];
  const keyDates = comp.keyDates ?? [];
  const showApply = canStartEntry(comp);
  const showGuidelines = canViewGuidelines(comp);

  return (
    <>
      <EditorialHeader
        eyebrow={category}
        title={comp.title[locale]}
        description={summary}
        crumbs={[
          { label: ko ? "공모전" : "Competitions", href: "/contests" },
          { label: comp.title[locale] },
        ]}
        locale={locale}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[16px] font-semibold text-ink-strong">
            <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[st]}`} />
            {STATUS_LABEL[st][locale]}
          </span>
        }
      />

      {/* Hero image band (cover art or neutral tint) */}
      <div className="mx-auto max-w-page px-6 pt-10 lg:pt-14">
        <div
          className="aspect-[21/9] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: cover ? `url(${cover}), ${NEUTRAL_TINT}` : NEUTRAL_TINT }}
          role="img"
          aria-label={comp.title[locale]}
        />
      </div>

      <section className="mx-auto max-w-page px-6 py-12 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="min-w-0">
            {facts.length > 0 && (
              <dl className="border-t border-line">
                {facts.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b border-line py-4"
                  >
                    <dt className="text-[16px] text-ink-strong">{k}</dt>
                    <dd className="text-[16px] font-semibold text-ink-strong">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {categories.length > 0 && (
              <Section title={ko ? "모집 부문" : "Divisions"}>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-full border border-line px-4 py-2 text-[16px] text-ink-strong"
                    >
                      {c.label[locale]}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {ageGroups.length > 0 && (
              <Section title={ko ? "참가 대상" : "Eligibility"}>
                <ul className="border-t border-line">
                  {ageGroups.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between border-b border-line py-3 text-[16px] text-ink-strong"
                    >
                      <span>{g.label[locale]}</span>
                      <span className="font-semibold">
                        {g.minAgeInclusive}–{g.maxAgeInclusive}
                        {ko ? "세" : " yrs"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {uploads.length > 0 && (
              <Section title={ko ? "제출 규격" : "Submissions"}>
                <ul className="border-t border-line">
                  {uploads.map((u, i) => {
                    const parts: string[] = [];
                    parts.push((ko ? "파일 " : "") + `${u.maxFiles}${ko ? "개" : " file(s)"}`);
                    if (u.maxBytes)
                      parts.push(`${Math.round(u.maxBytes / (1024 * 1024))}MB`);
                    if (u.minPages) parts.push(ko ? `최소 ${u.minPages}쪽` : `min ${u.minPages} pages`);
                    return (
                      <li
                        key={`${u.purpose}-${i}`}
                        className="flex flex-col gap-1 border-b border-line py-3 text-[16px] text-ink-strong sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-semibold">{u.allowedMediaTypes.join(", ")}</span>
                        <span>{parts.join(" · ")}</span>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {keyDates.length > 0 && (
              <Section title={ko ? "주요 일정" : "Key dates"}>
                <div className="border-t border-line">
                  {keyDates.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between border-b border-line py-4"
                    >
                      <span className="text-[16px] font-semibold text-ink-strong">
                        {d.label[locale]}
                      </span>
                      <span className="text-[16px] text-ink-strong">
                        {fmtKeyDate(d.value, ko)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Sticky CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-2xl border border-line bg-white p-6">
              {comp.fee && (
                <>
                  <p className="text-[16px] text-ink-strong">{ko ? "참가비" : "Entry fee"}</p>
                  <p className="mt-1 font-title font-bold text-[26px] text-ink-strong">
                    {money(comp.fee.amountMinor)}
                  </p>
                </>
              )}
              {period && (
                <p className="mt-1 text-[16px] text-ink-strong">
                  {ko ? "접수" : "Entry"} {period}
                </p>
              )}
              {showApply ? (
                <Link
                  href={`/submit?contest=${comp.slug}`}
                  className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90"
                >
                  {ko ? "작품 접수하기" : "Apply now"}
                  <span aria-hidden>›</span>
                </Link>
              ) : (
                <span className="mt-5 flex cursor-not-allowed items-center justify-center rounded-lg border border-line bg-neutral-50 px-5 py-3 text-[16px] font-semibold text-ink-strong">
                  {ko ? "접수 준비 중" : "Not open yet"}
                </span>
              )}
              {showGuidelines && comp.guidelines && (
                <a
                  href={comp.guidelines.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center rounded-lg border border-line px-5 py-3 text-[16px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
                >
                  {ko ? "공모요강 다운로드" : "Download guidelines"}
                </a>
              )}
              <Link
                href="/notices"
                className="mt-2 flex items-center justify-center rounded-lg px-5 py-3 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
              >
                {ko ? "문의하기" : "Contact us"}
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) */}
      {showApply && (
        <div className="sticky bottom-0 z-40 border-t border-line bg-white px-6 py-3 lg:hidden">
          <Link
            href={`/submit?contest=${comp.slug}`}
            className="flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white"
          >
            {ko ? "작품 접수하기" : "Apply now"}
            {comp.fee ? ` · ${money(comp.fee.amountMinor)}` : ""}
            <span aria-hidden>›</span>
          </Link>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-8">
      <h2 className="font-title font-bold text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.02em] text-ink-strong">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </div>
  );
}
