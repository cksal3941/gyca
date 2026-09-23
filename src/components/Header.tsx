"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { useSession } from "@/lib/auth-client";
import { useLocale } from "@/components/i18n/LocaleProvider";
import LocaleToggle from "@/components/i18n/LocaleToggle";
import type { Bi } from "@/lib/i18n";

// Nav mapped 1:1 to the pages that exist. (Deployed myslide labels like
// Bookstore/Epilogue/Gallery/Contact had no GYCA pages, so the menu is
// restructured to the real IA.)
const MENU: { label: Bi; href: string }[] = [
  { label: { en: "Competitions", ko: "공모전" }, href: "/contests" },
  { label: { en: "Exhibitions", ko: "전시·공연" }, href: "/exhibitions" },
  { label: { en: "Winners", ko: "수상작" }, href: "/winners" },
  { label: { en: "About", ko: "소개" }, href: "/about" },
  { label: { en: "Notice", ko: "공지사항" }, href: "/notices" },
  { label: { en: "Help", ko: "이용안내" }, href: "/help" },
];

const MYPAGE: Bi = { en: "My Page", ko: "마이페이지" };

// The reference uses the simple-line-icons webfont (icon-social-instagram /
// icon-globe). Render the same glyphs so the icons match exactly.
function Icon({ name, size }: { name: string; size: number }) {
  return (
    <i
      className={`icon-${name} block leading-none`}
      style={{ fontSize: size }}
      aria-hidden
    />
  );
}

/** Circular avatar: user image if present, otherwise the name's initial. */
function Avatar({
  name,
  image,
  size = 30,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full border border-black/10 object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-blue font-nav font-semibold text-white uppercase"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name?.trim()?.charAt(0) || "?"}
    </span>
  );
}

/** GitHub-style account dropdown for the signed-in state. */
function AccountMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!session) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center p-[5px] !transition-none"
      >
        <Avatar name={session.user.name} image={session.user.image} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-lg border border-black/10 bg-white text-ink shadow-lg">
          <div className="border-b border-black/10 px-4 py-3">
            <p className="text-[14px] leading-tight text-ink-strong">
              Signed in as
            </p>
            <p className="truncate text-[15px] font-semibold leading-snug text-ink-strong">
              {session.user.name}
            </p>
            <p className="truncate text-[14px] text-ink-strong">
              {session.user.email}
            </p>
          </div>
          <nav className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[14px] !transition-none hover:bg-brand-blue hover:text-white"
            >
              <Icon name="settings" size={14} />
              Settings
            </Link>
            <Link
              href="/signout"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[14px] !transition-none hover:bg-brand-blue hover:text-white"
            >
              <Icon name="logout" size={14} />
              Sign out
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}

function AuthNav({ mobile = false }: { mobile?: boolean }) {
  const { data: session, isPending } = useSession();
  const { locale } = useLocale();

  if (isPending) return null;

  if (mobile) {
    return session ? (
      <div className="flex items-center justify-between border-b border-line py-3 font-nav text-[16px]">
        <span className="flex items-center gap-2.5">
          <Avatar name={session.user.name} image={session.user.image} size={26} />
          {session.user.name}
        </span>
        <span className="flex items-center gap-4">
          <Link href="/mypage" className="hover:text-brand-blue">
            {MYPAGE[locale]}
          </Link>
          <Link href="/settings" className="text-ink-strong hover:text-brand-blue">
            Settings
          </Link>
          <Link href="/signout" className="text-ink-strong hover:text-brand-blue">
            Sign out
          </Link>
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-6 border-b border-line py-3 font-nav text-[16px]">
        <Link href="/login" className="flex items-center gap-2 hover:text-brand-blue">
          <Icon name="login" size={16} /> Sign in
        </Link>
        <Link href="/signup" className="flex items-center gap-2 hover:text-brand-blue">
          <Icon name="user-follow" size={16} /> Sign up
        </Link>
      </div>
    );
  }

  // Desktop: narrow screens show icons only, labels appear from 2xl (1536px+)
  return session ? (
    <div className="hidden items-center gap-3 lg:flex">
      <Link
        href="/mypage"
        className="font-nav text-[15px] whitespace-nowrap !transition-none hover:text-white"
      >
        {MYPAGE[locale]}
      </Link>
      <AccountMenu />
    </div>
  ) : (
    <div className="hidden items-center lg:flex">
      <Link
        href="/login"
        title="Sign in"
        className="flex items-center !transition-none hover:text-white"
      >
        <span className="inline-flex items-center justify-center p-[10px]">
          <Icon name="login" size={17} />
        </span>
        <span className="hidden font-nav text-[15px] whitespace-nowrap 2xl:inline">
          Sign in
        </span>
      </Link>
      <Link
        href="/signup"
        title="Sign up"
        className="flex items-center !transition-none hover:text-white 2xl:ml-2"
      >
        <span className="inline-flex items-center justify-center p-[10px]">
          <Icon name="user-follow" size={17} />
        </span>
        <span className="hidden font-nav text-[15px] whitespace-nowrap 2xl:inline">
          Sign up
        </span>
      </Link>
    </div>
  );
}

export default function Header() {
  const { locale } = useLocale();
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Header is always black: white text + white divider lines.
  const line = "border-white";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] border-b-2 bg-black text-white ${line}`}
    >
      <div className="mx-auto flex h-[70px] max-w-[1570px] items-stretch">
        {/* Logo zone — sits at the container's left edge (no padding), matching
            the reference's symmetric ~167px inset. */}
        <Link
          href="/"
          aria-label="GYCA home"
          className={`flex w-[150px] shrink-0 items-center pl-4 !transition-none sm:w-[190px] lg:w-[214px] lg:border-r-2 lg:pl-0 ${line}`}
        >
          <Logo variant="light" />
        </Link>

        {/* Menu zone — right-aligned (menu hugs the icons side, gap sits between
            logo and menu). Each item padded 30px left/right, items touch. */}
        <nav
          className={`hidden flex-1 items-center justify-end lg:flex lg:border-r-2 ${line}`}
        >
          {MENU.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-full items-center px-[30px] font-nav text-[17px] whitespace-nowrap !transition-none hover:text-white ${
                isActive(item.href) ? "font-semibold text-white" : "font-normal text-white/80"
              }`}
            >
              {item.label[locale]}
            </Link>
          ))}
        </nav>

        {/* Icons zone — sits at the container's right edge (no padding). */}
        <div className="ml-auto flex shrink-0 items-center pl-4 pr-4 lg:ml-0 lg:pl-[26px] lg:pr-2">
          <LocaleToggle className="mr-4 hidden lg:flex" />
          <AuthNav />

          {/* Hamburger */}
          <button
            className="flex flex-col gap-[5px] p-2 !transition-none lg:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
            <span className="block h-[2px] w-6 bg-current" />
          </button>
        </div>
      </div>

      {/* Mobile slide menu */}
      {mobileOpen && (
        <div className="border-t-2 border-current bg-white text-ink lg:hidden">
          <nav className="flex flex-col px-6 py-2">
            <LocaleToggle className="border-b border-line py-3" />
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`border-b border-line py-3 font-nav text-[16px] hover:text-brand-blue ${
                  isActive(item.href) ? "font-semibold text-brand-blue" : ""
                }`}
              >
                {item.label[locale]}
              </Link>
            ))}
            <AuthNav mobile />
          </nav>
        </div>
      )}
    </header>
  );
}
