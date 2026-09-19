"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { APPLY, APPLY_HREF, DETAIL_HREF, LEIPZIG_SLUG, pick, type Locale } from "@/lib/content/leipzig-home";
import { ArrowRight } from "@/components/landing/icons";
import { getCompetitionBySlug, canStartEntry } from "@/lib/api";

/**
 * Section 6 · Apply CTA — fee + Apply.
 *
 * CLIENT component: the Apply gate is driven by the REAL competition response
 * (GET /competitions/{slug}) with the Better Auth session, never a local "접수 중"
 * constant. Apply is offered ONLY when the parsed competition allows `start_entry`
 * (open + application-ready). While the lookup is in flight, or on failure / not-
 * yet-open, it shows a "준비 중" state — never a fake Apply link.
 */
export default function ApplyCta({ locale = "en" }: { locale?: Locale }) {
  const [canApply, setCanApply] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getCompetitionBySlug(LEIPZIG_SLUG).then((r) => {
      if (alive) setCanApply(r.kind === "success" && canStartEntry(r.data));
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-page px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-8 border border-line bg-white p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
              {pick(APPLY.title, locale)}
            </h2>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[16px] font-medium text-ink-strong">{pick(APPLY.feeLabel, locale)}</span>
              <span className="text-[24px] font-extrabold text-ink-strong">{pick(APPLY.fee, locale)}</span>
              <span className="text-[16px] text-ink-strong">
                · {locale === "ko" ? "마감 2026.12.31" : "Deadline 31 Dec 2026"}
              </span>
            </p>
            {canApply === false && (
              <p className="mt-3 text-[16px] text-ink-strong">
                {locale === "ko"
                  ? "접수 준비 중입니다. 오픈되면 신청하실 수 있습니다."
                  : "Applications are being prepared. You can apply once entry opens."}
              </p>
            )}
            {canApply && !APPLY.guidelinesReady && (
              <p className="mt-3 text-[16px] text-ink-strong">{pick(APPLY.guidelinesPendingNote, locale)}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={DETAIL_HREF}
              className="inline-flex items-center gap-2.5 border border-ink-strong/20 bg-white px-8 py-4 text-[16px] font-semibold text-ink-strong transition-colors hover:border-brand-blue hover:text-brand-blue"
            >
              {locale === "ko" ? "공모 자세히 보기" : "View competition"}
              <ArrowRight size={18} />
            </Link>
            {canApply ? (
              <Link
                href={APPLY_HREF}
                className="inline-flex items-center gap-2.5 bg-brand-blue px-8 py-4 text-[16px] font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                {pick(APPLY.primaryCta, locale)}
                <ArrowRight size={18} />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                aria-busy={canApply === null}
                className="inline-flex cursor-not-allowed items-center gap-2.5 border border-line bg-surface px-8 py-4 text-[16px] font-semibold text-ink-strong opacity-70"
              >
                {locale === "ko" ? "준비 중" : "Coming soon"}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
