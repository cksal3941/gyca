import PageHeader from "@/components/site/PageHeader";
import { getServerLocale } from "@/lib/i18n/server";
import PaymentConfirm from "@/components/mypage/PaymentConfirm";

// Toss Payments successUrl target. Toss appends paymentKey, orderId and amount. Arriving here is
// NOT a completed payment: the client view sends paymentKey to POST /orders/{id}/confirm and the
// server verifies the approval with the provider before issuing a receipt number.

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;

export default async function EntryPaymentSuccessPage({ params, searchParams }: {
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
          providerReturn={{ kind: "success", paymentKey: first(query.paymentKey), orderId: first(query.orderId), amount: first(query.amount) }} />
      </section>
    </>
  );
}
