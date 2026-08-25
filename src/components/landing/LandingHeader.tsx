import Link from "next/link";
import { ArrowRight } from "./icons";

const NAV = [
  "Youth Awards",
  "Professional Awards",
  "Global Programs",
  "Awardees",
  "About",
];

export default function LandingHeader() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-[72px] max-w-shell items-center gap-8 px-6">
        {/* Wordmark */}
        <Link
          href="#top"
          className="text-[26px] font-extrabold tracking-[-0.02em] text-ink-strong"
        >
          GYCA
        </Link>

        {/* Primary nav */}
        <nav className="hidden flex-1 items-center justify-center gap-9 lg:flex">
          {NAV.map((item) => (
            <a
              key={item}
              href="#"
              className="text-[15px] font-medium text-ink-strong hover:text-brand-blue"
            >
              {item}
            </a>
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
            href="/login"
            className="hidden text-[15px] font-medium text-ink hover:text-brand-blue sm:block"
          >
            Log In
          </Link>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Apply Now
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </header>
  );
}
