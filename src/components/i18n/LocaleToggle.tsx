"use client";

import { useLocale } from "./LocaleProvider";
import { LOCALES, type Locale } from "@/lib/i18n";

const LABEL: Record<Locale, string> = { en: "EN", ko: "KO" };

/**
 * EN / KO switch. Inherits the header's current text color; the active locale is
 * bold, the inactive is dimmed. Purely a language switch — no route change.
 */
export default function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={`flex items-center gap-2 font-nav text-[15px] ${className}`}>
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="opacity-30">·</span>}
          <button
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`!transition-none hover:text-brand-blue ${
              locale === l ? "font-bold" : "font-normal opacity-60"
            }`}
          >
            {LABEL[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
