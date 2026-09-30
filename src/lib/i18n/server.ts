// Server-only locale reader. Use in Server Components to translate without a
// route change (reads the same cookie the client toggle writes). Do NOT import
// this from Client Components — `next/headers` is server-only. Client Components
// use `useLocale()` from LocaleProvider instead.
import { cookies } from "next/headers";
import { LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(LOCALE_COOKIE)?.value);
}
