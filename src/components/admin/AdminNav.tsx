"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/contests", label: "Contests" },
  { href: "/admin/news", label: "News" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/projects", label: "Epilogues" },
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-fit flex-row gap-1 overflow-x-auto md:flex-col">
      {LINKS.map((l) => {
        const active =
          l.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-2 text-left text-sm whitespace-nowrap !transition-none ${
              active
                ? "bg-brand-blue/10 font-semibold text-brand-blue"
                : "hover:bg-black/5"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
