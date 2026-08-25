import Link from "next/link";
import type { ReactNode } from "react";

type Crumb = { label: string; href?: string };

/** Standard page header for sub-pages: eyebrow + serif title + description,
 *  with an optional breadcrumb and right-aligned action slot. */
export default function PageHeader({
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
    <section className="border-b border-line bg-canvas">
      <div className="mx-auto max-w-shell px-6 py-12 lg:py-16">
        {crumbs && crumbs.length > 0 && (
          <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[16px] text-ink-strong">
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
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            {eyebrow && (
              <p className="text-[16px] font-bold uppercase tracking-[0.14em] text-brand-blue">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-2 font-serif text-[34px] font-bold leading-tight tracking-[-0.01em] text-ink-strong">
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
  );
}
