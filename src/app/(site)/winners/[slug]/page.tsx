import Link from "next/link";
import { notFound } from "next/navigation";
import EditorialHeader from "@/components/site/EditorialHeader";
import { coverBg } from "@/lib/unsplash";
import { getWinner, WINNERS, CATEGORY_LABEL } from "@/lib/site-data";
import { getServerLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return WINNERS.map((w) => ({ slug: w.slug }));
}

export default async function WinnerDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale: Locale = await getServerLocale();
  const w = getWinner(slug);
  if (!w) notFound();

  const ko = locale === "ko";
  const meta: [string, string][] = [
    [ko ? "수상명" : "Award", w.award],
    [ko ? "부문" : "Field", CATEGORY_LABEL[w.category]?.[locale] ?? w.category],
    [ko ? "연도" : "Year", w.year],
    [ko ? "참가자" : "Artist", `${w.artist} · ${w.country}`],
  ];

  return (
    <>
      <EditorialHeader
        eyebrow={w.award}
        title={w.title}
        crumbs={[{ label: ko ? "수상작" : "Winners", href: "/winners" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6 py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: award facts + back */}
          <div>
            <dl className="border-t border-line">
            {meta.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b border-line py-4"
              >
                <dt className="text-[16px] text-ink-strong">{k}</dt>
                <dd className="text-[16px] font-semibold text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/winners"
            className="mt-8 inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            {ko ? "수상작 갤러리로 돌아가기" : "Back to the winners gallery"}
            <span aria-hidden>›</span>
          </Link>
        </div>

        {/* Right: image + caption + text */}
        <div>
          <div
            className="aspect-[4/5] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
            style={{ backgroundImage: coverBg(w.slug, `/images/winners/${w.slug}.jpg`) }}
            role="img"
            aria-label={w.title}
          />
          <div className="mt-4 flex items-center justify-between text-[16px] text-ink-strong">
            <span>
              {w.artist} · {w.country}
            </span>
            <span>
              {CATEGORY_LABEL[w.category]?.[locale] ?? w.category} · {w.year}
            </span>
          </div>

          <h2 className={`mt-12 break-keep font-bold text-[clamp(26px,2.6vw,32px)] leading-[1.15] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
            {ko ? "작품 설명" : "About the work"}
          </h2>
          <p className="mt-3 text-[16px] leading-[1.9] text-ink-strong">
            {ko
              ? "작가가 작품을 통해 전하고자 한 주제와 표현 의도를 담은 설명입니다. 심사에서는 창의성, 주제 이해, 표현력, 완성도, 발전 가능성을 종합적으로 평가했습니다."
              : "A description of the theme and intent the artist conveys through the work. Judging weighed originality, understanding of the theme, expression, completion, and potential."}
          </p>

          <h2 className={`mt-10 break-keep font-bold text-[clamp(26px,2.6vw,32px)] leading-[1.15] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
            {ko ? "심사평" : "Jury comment"}
          </h2>
          <blockquote className="mt-3 border-l-2 border-brand-blue pl-5 text-[16px] leading-[1.9] text-ink">
            {ko
              ? "“주제를 대하는 진정성과 완성도가 돋보이는 작품으로, 심사위원단의 높은 평가를 받았습니다.”"
              : "“A work notable for its sincerity toward the theme and its completion, highly rated by the jury.”"}
          </blockquote>
        </div>
      </div>
      </section>
    </>
  );
}
