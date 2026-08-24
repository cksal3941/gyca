"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";
import { useSession } from "@/lib/auth-client";

const MENU = [
  "About",
  "Bookstore",
  "News",
  "Contests",
  "Epilogue",
  "Winners",
  "Gallery",
  "Contact",
];

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
            <p className="text-[13px] leading-tight text-neutral-500">
              Signed in as
            </p>
            <p className="truncate text-[14px] font-semibold leading-snug">
              {session.user.name}
            </p>
            <p className="truncate text-[12px] text-neutral-500">
              {session.user.email}
            </p>
          </div>
          <nav className="py-1">
            <Link
              href="/signout"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-[13px] !transition-none hover:bg-brand-blue hover:text-white"
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

  if (isPending) return null;

  if (mobile) {
    return session ? (
      <div className="flex items-center justify-between border-b border-line py-3 font-nav text-[16px]">
        <span className="flex items-center gap-2.5">
          <Avatar name={session.user.name} image={session.user.image} size={26} />
          {session.user.name}
        </span>
        <Link href="/signout" className="text-neutral-500 hover:text-brand-blue">
          Sign out
        </Link>
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
    <div className="hidden items-center lg:flex">
      <AccountMenu />
    </div>
  ) : (
    <div className="hidden items-center lg:flex">
      <Link
        href="/login"
        title="Sign in"
        className="flex items-center !transition-none hover:text-brand-blue"
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
        className="flex items-center !transition-none hover:text-brand-blue 2xl:ml-2"
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
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      // Hysteresis: enter at 90px, leave at 40px — avoids rapid toggling
      // (flicker) when the scroll position hovers near a single threshold.
      setScrolled((prev) => (prev ? y > 40 : y > 90));
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Default: white bg + dark text + black lines. Scrolled: black bg + white text + white lines.
  const line = scrolled ? "border-white" : "border-black";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1000] border-b-2 ${line} ${
        scrolled ? "bg-black text-white" : "bg-white text-ink"
      }`}
    >
      <div className="mx-auto flex h-[70px] max-w-[1570px] items-stretch">
        {/* Logo zone — sits at the container's left edge (no padding), matching
            the reference's symmetric ~167px inset. */}
        <a
          href="#top"
          className={`flex w-[150px] shrink-0 items-center pl-4 !transition-none sm:w-[190px] lg:w-[214px] lg:border-r-2 lg:pl-0 ${line}`}
        >
          <Logo variant={scrolled ? "light" : "dark"} />
        </a>

        {/* Menu zone — right-aligned (menu hugs the icons side, gap sits between
            logo and menu). Each item padded 30px left/right, items touch. */}
        <nav
          className={`hidden flex-1 items-center justify-end lg:flex lg:border-r-2 ${line}`}
        >
          {MENU.map((item) => (
            <a
              key={item}
              href="#"
              className="flex h-full items-center px-[30px] font-nav text-[17px] font-normal whitespace-nowrap !transition-none hover:text-brand-blue"
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Icons zone — sits at the container's right edge (no padding). */}
        <div className="ml-auto flex shrink-0 items-center pl-4 pr-4 lg:ml-0 lg:pl-[26px] lg:pr-2">
          <AuthNav />
          {/* Instagram: 39×39 box (10px padding, 19px glyph) */}
          <a
            href="#"
            aria-label="Instagram"
            className="inline-flex items-center justify-center p-[10px] !transition-none hover:text-brand-blue"
          >
            <Icon name="social-instagram" size={19} />
          </a>

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
            {MENU.map((item) => (
              <a
                key={item}
                href="#"
                className="border-b border-line py-3 font-nav text-[16px] hover:text-brand-blue"
              >
                {item}
              </a>
            ))}
            <AuthNav mobile />
            <div className="flex items-center gap-4 py-3 text-neutral-600">
              <Icon name="social-instagram" size={19} />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
