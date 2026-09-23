import EntryDetailView from "@/components/mypage/EntryDetailView";
import { getServerLocale } from "@/lib/i18n/server";

// Entry detail (My Page → 접수 상세). Thin server shell: it only resolves the
// route id + locale and hands off to a CLIENT view. The data fetch runs in the
// browser with the Better Auth session — a server component cannot forward the
// session cookie to the same-origin /api/v1 adapter, so SSR-fetching here would
// always 404 in live mode.

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  return <EntryDetailView id={id} locale={locale} />;
}
