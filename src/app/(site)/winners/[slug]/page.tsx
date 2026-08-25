import Link from "next/link";
import { notFound } from "next/navigation";
import { getWinner, WINNERS, AWARD_COLOR } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

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

  const meta: [string, string][] = [
    ["수상명", w.award],
    ["부문", w.category],
    ["연도", w.year],
    ["참가자", `${w.artist} · ${w.country}`],
  ];

  return (
    <section className="mx-auto max-w-shell px-6 py-16 lg:py-24">
      <nav className="mb-10 flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
        <Link href="/" className="hover:text-brand-blue">
          홈
        </Link>
        <span className="text-line">/</span>
        <Link href="/winners" className="hover:text-brand-blue">
          수상작
        </Link>
        <span className="text-line">/</span>
        <span className="text-ink-strong">{w.title}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: title + index */}
        <div>
          <p className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.14em] text-brand-blue">
            <span className={`h-2.5 w-2.5 rounded-full ${AWARD_COLOR[w.award]}`} />
            {w.award}
          </p>
          <h1 className="font-serif text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-[0.01em] text-ink-strong">
            {w.title}
          </h1>

          <dl className="mt-10 border-t border-line">
            {meta.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b border-line py-4"
              >
                <dt className="text-[14px] text-neutral-500">{k}</dt>
                <dd className="text-[15px] font-semibold text-ink-strong">{v}</dd>
              </div>
            ))}
          </dl>

          <Link
            href="/winners"
            className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            수상작 갤러리로 돌아가기
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Right: image + caption + text */}
        <div>
          <div
            className="aspect-[4/5] w-full rounded-2xl bg-cover bg-center ring-1 ring-black/5"
            style={{ backgroundImage: w.tint }}
            role="img"
            aria-label={w.title}
          />
          <div className="mt-4 flex items-center justify-between text-[13px] text-neutral-500">
            <span>
              {w.artist} · {w.country}
            </span>
            <span>
              {w.category} · {w.year}
            </span>
          </div>

          <h2 className="mt-12 font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
            작품 설명
          </h2>
          <p className="mt-3 text-[14px] leading-[1.9] text-neutral-500">
            작가가 작품을 통해 전하고자 한 주제와 표현 의도를 담은 설명입니다.
            심사에서는 창의성, 주제 이해, 표현력, 완성도, 발전 가능성을 종합적으로
            평가했습니다.
          </p>

          <h2 className="mt-10 font-serif text-[clamp(26px,2.6vw,32px)] leading-[1.15] tracking-[0.01em] text-ink-strong">
            심사평
          </h2>
          <blockquote className="mt-3 border-l-2 border-brand-blue pl-5 text-[14px] leading-[1.9] text-ink">
            “주제를 대하는 진정성과 완성도가 돋보이는 작품으로, 심사위원단의 높은
            평가를 받았습니다.”
          </blockquote>
        </div>
      </div>
    </section>
  );
}
