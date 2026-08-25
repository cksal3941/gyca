"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { ArrowRight } from "@/components/landing/icons";

const NAV = [
  { label: "공모전", href: "/contests" },
  { label: "전시·공연", href: "/exhibitions" },
  { label: "수상작", href: "/winners" },
  { label: "GYCA 소개", href: "/about" },
  { label: "공지사항", href: "/notices" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-shell items-center gap-8 px-6">
        <Link
          href="/"
          className="text-[26px] font-extrabold tracking-[-0.02em] text-ink-strong"
        >
          GYCA
        </Link>

        {/* Primary nav */}
        <nav className="hidden flex-1 items-center justify-center gap-8 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-[15px] font-medium hover:text-brand-blue ${
                isActive(item.href) ? "text-brand-blue" : "text-ink-strong"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Utilities */}
        <div className="ml-auto flex items-center gap-5 lg:ml-0">
          <div className="hidden items-center gap-2 text-[13px] font-semibold text-neutral-500 sm:flex">
            <button className="text-ink-strong hover:text-brand-blue">EN</button>
            <span className="text-line">|</span>
            <button className="hover:text-brand-blue">KR</button>
          </div>
          <Link
            href={session ? "/mypage" : "/login"}
            className="hidden text-[15px] font-medium text-ink-strong hover:text-brand-blue sm:block"
          >
            {session ? "마이페이지" : "로그인"}
          </Link>
          <Link
            href="/submit"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            작품 접수
            <ArrowRight size={16} />
          </Link>

          {/* Hamburger */}
          <button
            className="flex flex-col gap-[5px] p-1 lg:hidden"
            aria-label="메뉴 열기"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="block h-[2px] w-6 bg-ink-strong" />
            <span className="block h-[2px] w-6 bg-ink-strong" />
            <span className="block h-[2px] w-6 bg-ink-strong" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <nav className="mx-auto flex max-w-shell flex-col px-6 py-2">
            {session && (
              <div className="flex items-center justify-between border-b border-line py-3 text-[15px]">
                <span className="font-semibold text-ink-strong">
                  {session.user.name}
                </span>
                <Link href="/mypage" className="text-brand-blue">
                  마이페이지
                </Link>
              </div>
            )}
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-line py-3 text-[16px] text-ink-strong hover:text-brand-blue"
              >
                {item.label}
              </Link>
            ))}
            {!session && (
              <Link
                href="/login"
                className="py-3 text-[16px] text-ink-strong hover:text-brand-blue"
              >
                로그인 · 회원가입
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
