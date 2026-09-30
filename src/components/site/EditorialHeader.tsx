import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

type Crumb = { label: string; href?: string };

/** Airy page intro — large display title on white, in the reference site's
 *  typographic language (Bebas for Latin, Pretendard for Korean). Used by
 *  content pages so sub-pages read as one service with the home. */
export default function EditorialHeader({
  eyebrow,
  title,
  description,
  crumbs,
  action,
  locale = "en",
  serif = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  action?: ReactNode;
  locale?: Locale;
  serif?: boolean;
}) {
  return (
    <>
      {/* Hero band — unified with the admin hero: soft canvas bg, thin divider,
          black eyebrow, 38px title, left-aligned. */}
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto flex min-h-[240px] max-w-page flex-col justify-center px-6 py-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              {eyebrow && (
                <p className="text-[16px] font-bold uppercase tracking-[0.14em] text-ink-strong">
                  {eyebrow}
                </p>
              )}
              <h1
                className={`mt-2 break-keep text-[38px] leading-tight text-ink-strong ${
                  serif
                    ? "font-serif tracking-[0.005em]"
                    : locale === "ko"
                      ? "font-sans font-bold tracking-[-0.01em]"
                      : "font-title font-bold tracking-[0.02em]"
                }`}
              >
                {title}
              </h1>
              {description && (
                <p className="mt-3 max-w-[46rem] text-[16px] leading-[1.7] text-ink-strong">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </div>
      </section>

      {/* Breadcrumb — its own bar below the hero. */}
      {crumbs && crumbs.length > 0 && (
        <div className="border-b border-line">
          <nav className="mx-auto flex max-w-page flex-wrap items-center gap-1.5 px-6 py-4 text-[16px] text-ink-strong">
            <Link href="/" className="hover:text-brand-blue">
              {locale === "ko" ? "홈" : "Home"}
            </Link>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5">
                <span className="text-line">/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:text-brand-blue">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-strong">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
