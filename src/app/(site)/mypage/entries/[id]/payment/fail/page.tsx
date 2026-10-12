import PageHeader from "@/components/site/PageHeader";
import { getServerLocale } from "@/lib/i18n/server";
import PaymentConfirm from "@/components/mypage/PaymentConfirm";

// Toss Payments failUrl target. Toss appends code and message (and orderId). Nothing is confirmed
// here; the view shows the provider's reason and the server-side order state.

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function EntryPaymentFailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const locale = await getServerLocale();
  const ko = locale === "ko";
  return (
    <>
      <PageHeader locale={ko ? "ko" : "en"} eyebrow="My Page" title={ko ? "결제 확인" : "Payment"}
        crumbs={[{ label: ko ? "마이페이지" : "My Page", href: "/mypage" },
          { label: ko ? "접수 상세" : "Entry detail", href: `/mypage/entries/${id}` }, { label: ko ? "결제 확인" : "Payment" }]} />
      <section className="mx-auto max-w-page px-6 py-12">
        <PaymentConfirm id={id} locale={locale}
          providerReturn={{ kind: "fail", code: first(query.code), message: first(query.message), orderId: first(query.orderId) }} />
      </section>
    </>
  );
}
