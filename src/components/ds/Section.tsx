import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section title: blue eyebrow + large display title (reference typography;
 *  Bebas for Latin, Pretendard for Korean). No gray text. */
export function SectionTitle({
  eyebrow,
  title,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 font-title text-[clamp(26px,3vw,40px)] font-bold leading-[1.1] tracking-[0.02em] text-ink-strong">
        {title}
      </h2>
    </div>
  );
}

/** Text link with a trailing arrow that nudges on hover. Renders a Next Link
 *  when `href` is internal, else a plain anchor. */
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = cn(
    "group inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong outline-none hover:text-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
    className,
  );
  const arrow = (
    <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
      →
    </span>
  );
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {children}
      {arrow}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
      {arrow}
    </a>
  );
}
