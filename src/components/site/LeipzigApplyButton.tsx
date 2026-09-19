"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCompetitionBySlug, canStartEntry } from "@/lib/api";
import { LEIPZIG_SLUG } from "@/lib/content/leipzig-detail";
import type { Locale } from "@/lib/i18n";

// Apply CTA for the Leipzig detail page. This is a CLIENT component so the
// competition lookup runs in the browser with the Better Auth session — the page
// itself stays a server component (static SEO content). The Apply action is gated
// STRICTLY on the server competition's allowedActions (start_entry); a lookup
// failure or a not-yet-open policy falls to the "준비 중" state, never a fake Apply.
//
// While the lookup is in flight (`canApply === null`) we render the disabled
// state so an Apply link is never shown before the server confirms it is open.

const APPLY_HREF = `/submit?contest=${LEIPZIG_SLUG}`;

export default function LeipzigApplyButton({
  locale,
  variant,
}: {
  locale: Locale;
  variant: "desktop" | "mobile";
}) {
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

  const ko = locale === "ko";
  const applyLabel = variant === "mobile"
    ? ko ? "작품 접수하기 · €70" : "Apply now · €70"
    : ko ? "작품 접수하기" : "Apply now";
  const comingSoonLabel = ko ? "접수 준비 중" : "Opening soon";

  if (variant === "mobile") {
    return canApply ? (
      <Link
        href={APPLY_HREF}
        className="flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white"
      >
        {applyLabel}
        <span aria-hidden>›</span>
      </Link>
    ) : (
      <span
        aria-disabled="true"
        aria-busy={canApply === null}
        className="flex items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 text-[16px] font-semibold text-ink-strong"
      >
        {comingSoonLabel}
      </span>
    );
  }

  return canApply ? (
    <Link
      href={APPLY_HREF}
      className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-black px-5 py-3 text-[16px] font-semibold text-white hover:opacity-90"
    >
      {applyLabel}
      <span aria-hidden>›</span>
    </Link>
  ) : (
    <span
      aria-disabled="true"
      aria-busy={canApply === null}
      className="mt-5 flex cursor-not-allowed items-center justify-center rounded-lg border border-line bg-surface px-5 py-3 text-[16px] font-semibold text-ink-strong opacity-70"
    >
      {comingSoonLabel}
    </span>
  );
}
