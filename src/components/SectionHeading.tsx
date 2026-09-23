import Link from "next/link";
import type { Locale } from "@/lib/i18n";

type Props = {
  badge: string;
  title: string;
  locale?: Locale;
  /** "View all" destination — a real page (defaults to the notices hub). */
  href?: string;
};

/** Shared section header: colored badge + title + "View all / 전체 보기" link. */
export default function SectionHeading({ badge, title, locale = "en", href = "/notices" }: Props) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <span className="inline-block bg-brand-blue px-[15px] py-[9px] text-[14px] font-bold uppercase leading-none tracking-wide text-white">
          {badge}
        </span>
        <h2 className={`mt-4 break-keep text-[24px] font-bold text-ink-strong md:text-[28px] ${locale === "ko" ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.5px]"}`}>
          {title}
        </h2>
      </div>
      <Link
        href={href}
        className="group flex items-center gap-2 text-[16px] text-ink hover:text-brand-blue"
      >
        {locale === "ko" ? "전체 보기" : "View all"}
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    </div>
  );
}
