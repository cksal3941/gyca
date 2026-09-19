import Link from "next/link";
import { APPLY, APPLY_HREF, DETAIL_HREF, pick, type Locale } from "@/lib/content/leipzig-home";
import { ArrowRight } from "@/components/landing/icons";
import { getCompetitionSync, canStartEntry } from "@/lib/api";

/**
 * Section 6 · Apply CTA — fee + Apply.
 *
 * The Apply action is driven ONLY by the parsed competition's `allowedActions`
 * (start_entry); the client never derives its own allowance. When start_entry
 * is not offered (policy not configured / not open / archived), the CTA shows a
 * "준비 중" (being prepared) state instead of a live Apply link.
 *
 * NOTE: this is the Leipzig home section (not the currently-live deployed home).
 * `scenario` lets a preview pick the competition state; defaults to open-ready.
 */
export default function ApplyCta({
  locale = "en",
  scenario = "open-ready",
}: {
  locale?: Locale;
  scenario?: Parameters<typeof getCompetitionSync>[0];
}) {
  const state = getCompetitionSync(scenario);
  const canApply = state.kind === "success" && canStartEntry(state.data);

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-page px-6 py-20">
        <div className="flex flex-col items-start justify-between gap-8 border border-line bg-white p-8 sm:p-12 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-[clamp(28px,3.4vw,44px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
              {pick(APPLY.title, locale)}
            </h2>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[16px] font-medium text-ink-strong">
                {pick(APPLY.feeLabel, locale)}
              </span>
              <span className="text-[24px] font-extrabold text-ink-strong">
                {pick(APPLY.fee, locale)}
              </span>
              <span className="text-[16px] text-ink-strong">
                · {locale === "ko" ? "마감 2026.12.31" : "Deadline 31 Dec 2026"}
              </span>
            </p>
            {!canApply && (
              <p className="mt-3 text-[16px] text-ink-strong">
                {locale === "ko"
                  ? "접수 준비 중입니다. 오픈되면 신청하실 수 있습니다."
                  : "Applications are being prepared. You can apply once entry opens."}
              </p>
            )}
            {canApply && !APPLY.guidelinesReady && (
              <p className="mt-3 text-[16px] text-ink-strong">
                {pick(APPLY.guidelinesPendingNote, locale)}
              </p>
            )}
            {canApply && (
              <p className="mt-3 text-[16px] text-ink-strong">
                {locale === "ko"
                  ? "※ 데모 화면입니다. 실제 접수 가능 여부는 서버(공모 상태·정책)에 연결된 후 확정됩니다."
                  : "※ Demo preview. Whether entries are actually open is confirmed once connected to the server (competition status & policy)."}
              </p>
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
