import PageHeader from "@/components/site/PageHeader";
import { getServerLocale } from "@/lib/i18n/server";
import PaymentConfirm from "@/components/mypage/PaymentConfirm";

// Payment confirmation (My Page → 접수 상세 → 결제 확인). Thin server shell: it
// resolves the route id + locale and hands off to a CLIENT view. The entry fetch
// runs in the browser with the Better Auth session (a server component cannot
// forward the cookie, so SSR-fetching here would 404 in live mode). The real PG
// window is not wired — the client view shows an honest notice in live mode.

export default async function EntryPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const ko = locale === "ko";

  return (
    <>
      <PageHeader
        locale={ko ? "ko" : "en"}
        eyebrow="My Page"
        title={ko ? "결제 확인" : "Payment"}
        crumbs={[
          { label: ko ? "마이페이지" : "My Page", href: "/mypage" },
          { label: ko ? "접수 상세" : "Entry detail", href: `/mypage/entries/${id}` },
          { label: ko ? "결제 확인" : "Payment" },
        ]}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        <PaymentConfirm id={id} locale={locale} />
      </section>
    </>
  );
}
