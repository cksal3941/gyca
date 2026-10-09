// Lightweight i18n foundation — English default, Korean toggle.
//
// No per-language routing yet: the locale lives in a cookie (so server
// components render the right language) and a client context (so client
// components react to the toggle without a route change). Introducing
// per-language URLs affects existing routing + Better Auth callbacks and is
// deferred pending coordination with Codex.

export type Locale = "en" | "ko";
export const LOCALES: Locale[] = ["en", "ko"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "gyca_locale";

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "ko" ? "ko" : "en";
}

/** Bilingual string. */
export type Bi = { en: string; ko: string };
/** Bilingual multi-line (array of lines per locale). */
export type BiLines = { en: string[]; ko: string[] };

export function t(value: Bi, locale: Locale): string {
  return value[locale];
}
export function tl(value: BiLines, locale: Locale): string[] {
  return value[locale];
}
