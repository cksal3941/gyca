"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Admin page frame. FULL-WIDTH hero on top, then a two-column body (left rail +
// content). Both the hero content and the body share the admin container width
// (wider than the public max-w-page, aligned to the site header's 1570 grid) so
// the whole admin sits further left and uses more horizontal room. AdminShell
// renders its own hero (title/eyebrow/crumbs) — the public PageHeader is capped
// at max-w-page, so it can't span this wider grid. Admin chrome is Korean-only.
type Crumb = { label: string; href?: string };

const SECTIONS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/admin", label: "접수 관리", match: (p) => p === "/admin" || p.startsWith("/admin/entries") },
  { href: "/admin/competitions", label: "공모 관리", match: (p) => p.startsWith("/admin/competitions") },
  { href: "/admin/payments", label: "결제 운영", match: (p) => p.startsWith("/admin/payments") },
  { href: "/admin/content/editorial", label: "콘텐츠 관리", match: (p) => p.startsWith("/admin/content/editorial") },
  { href: "/admin/content/partners", label: "협력기관", match: (p) => p.startsWith("/admin/content/partners") },
  { href: "/admin/content/projects", label: "아카이브", match: (p) => p.startsWith("/admin/content/projects") },
  { href: "/admin/judges", label: "심사 운영", match: (p) => p.startsWith("/admin/judges") },
  { href: "/admin/results", label: "결과·인증서", match: (p) => p.startsWith("/admin/results") },
  { href: "/admin/privacy", label: "개인정보 요청", match: (p) => p.startsWith("/admin/privacy") },
];

export default function AdminShell({
  eyebrow,
  title,
  description,
  crumbs,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  crumbs?: Crumb[];
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <>
      {/* Full-width hero band; content aligned to the admin (1570) grid. */}
      <section className="border-b border-line bg-canvas">
        <div className="mx-auto flex min-h-[240px] max-w-[1570px] flex-col justify-center px-6 py-10">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              {eyebrow && (
                <p className="text-[16px] font-bold uppercase tracking-[0.14em] text-ink-strong">{eyebrow}</p>
              )}
              <h1 className="mt-2 break-keep font-sans text-[38px] font-bold leading-tight tracking-[-0.01em] text-ink-strong">
                {title}
              </h1>
              {description && (
                <p className="mt-3 max-w-[46rem] text-[16px] leading-[1.7] text-ink-strong">{description}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </div>
      </section>

      {/* Breadcrumb — its own bar below the hero, divided from the body by a
          bottom border so it doesn't blend into the section rail beneath it. */}
      {crumbs && crumbs.length > 0 && (
        <div className="border-b border-line">
          <nav className="mx-auto flex max-w-[1570px] flex-wrap items-center gap-1.5 px-6 py-4 text-[16px] text-ink-strong">
            <Link href="/" className="hover:text-brand-blue">홈</Link>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-1.5">
                <span className="text-line">/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:text-brand-blue">{c.label}</Link>
                ) : (
                  <span className="text-ink-strong">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      )}

      {/* Body: section rail + content, same 1570 grid. */}
      <div className="mx-auto flex max-w-[1570px] flex-col lg:flex-row lg:gap-8">
        <aside className="px-6 pt-8 lg:w-56 lg:shrink-0 lg:pt-10">
          <nav
            aria-label="관리자 메뉴"
            className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-2 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:sticky lg:top-[86px]"
          >
            {SECTIONS.map((s) => {
              const active = s.match(pathname);
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-[16px] transition-colors lg:shrink ${
                    active ? "bg-black font-semibold text-white" : "text-ink-strong hover:bg-surface"
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
