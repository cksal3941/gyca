import { notFound } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
import { getWinner, WINNERS, AWARD_COLOR } from "@/lib/site-data";

export function generateStaticParams() {
  return WINNERS.map((w) => ({ slug: w.slug }));
}

export default async function WinnerDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const w = getWinner(slug);
  if (!w) notFound();

  return (
    <>
      <PageHeader
        eyebrow={w.award}
        title={w.title}
        crumbs={[
          { label: "수상작", href: "/winners" },
          { label: w.title },
        ]}
        action={
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-[14px] font-semibold text-ink-strong">
            <span className={`h-2 w-2 rounded-full ${AWARD_COLOR[w.award]}`} />
            {w.award}
          </span>
        }
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* Work image + description */}
          <div className="min-w-0">
            <div
              className="h-[420px] w-full rounded-2xl bg-cover bg-center"
              style={{ backgroundImage: w.tint }}
              role="img"
              aria-label={w.title}
            />
            <div className="py-8">
              <h2 className="font-serif text-[22px] font-bold text-ink-strong">
                작품 설명
              </h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-neutral-500">
                {w.title}은(는) {w.category} 부문에서 선정된 수상작입니다.
                작가는 주제에 대한 깊은 이해와 독창적인 표현을 통해 작품 세계를
                완성했습니다. 심사위원단은 작품의 창의성과 완성도, 그리고 앞으로의
                발전 가능성을 높이 평가했습니다.
              </p>
            </div>
          </div>

          {/* Info + judge comment */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[13px] font-semibold text-ink-strong">
                참가자 공개정보
              </p>
              <dl className="mt-4 space-y-4">
                {[
                  ["참가자", `${w.artist} · ${w.country}`],
                  ["수상명", w.award],
                  ["부문", w.category],
                  ["연도", w.year],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] text-neutral-500">{k}</dt>
                    <dd className="mt-1 text-[14px] font-semibold text-ink-strong">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[13px] font-semibold text-ink-strong">심사평</p>
              <p className="mt-3 text-[14px] leading-[1.7] text-neutral-500">
                “주제를 바라보는 신선한 시선과 이를 구현해낸 표현력이 인상적입니다.
                완성도 높은 마무리와 함께 작가의 성장 가능성이 뚜렷하게 느껴지는
                작품입니다.”
              </p>
              <p className="mt-4 text-[13px] font-semibold text-ink-strong">
                — GYCA 심사위원단
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
