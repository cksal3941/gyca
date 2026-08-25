import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string };

/** Airy editorial page intro — large serif title on white, matching the
 *  reference site's sub-page style. Used by content pages. */
export default function EditorialHeader({
  eyebrow,
  title,
  description,
  crumbs,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  action?: ReactNode;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-shell px-6 pb-10 pt-14 lg:pb-14 lg:pt-20">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[16px] text-ink-strong">
            <Link href="/" className="hover:text-brand-blue">
              홈
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
            <h1 className="font-serif text-[clamp(44px,5.6vw,72px)] leading-[1.04] tracking-[0.01em] text-ink-strong">
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
