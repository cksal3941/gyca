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
    <section className="border-b-2 border-black">
      <div className="mx-auto max-w-page px-6 pb-12 pt-16 lg:pb-16 lg:pt-24">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[16px] text-ink-strong">
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
        )}
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            {eyebrow && (
              <p className="mb-3 text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
                {eyebrow}
              </p>
            )}
            <h1
              className={`break-keep text-[clamp(38px,4.8vw,60px)] leading-[1.08] text-ink-strong ${
                serif
                  ? "font-serif tracking-[0.005em]"
                  : "font-title font-bold tracking-[0.02em]"
              }`}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-6 max-w-[40rem] text-[16px] leading-[1.9] text-ink-strong">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </section>
  );
}
