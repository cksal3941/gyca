import Link from "next/link";
import { notFound } from "next/navigation";
import { getNotice, NOTICES } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

export function generateStaticParams() {
  return NOTICES.map((n) => ({ slug: n.slug }));
}

export default async function NoticeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const n = getNotice(slug);
  if (!n) notFound();

  return (
    <section className="mx-auto max-w-shell px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-[46rem]">
        <nav className="mb-10 flex flex-wrap items-center gap-1.5 text-[13px] text-neutral-500">
          <Link href="/" className="hover:text-brand-blue">
            홈
          </Link>
          <span className="text-line">/</span>
          <Link href="/notices" className="hover:text-brand-blue">
            공지사항
          </Link>
          <span className="text-line">/</span>
          <span className="text-ink-strong">{n.title}</span>
        </nav>

        <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
          {n.category}
        </p>
        <h1 className="mt-4 font-serif text-[clamp(30px,4.2vw,52px)] font-bold leading-[1.08] tracking-[-0.02em] text-ink-strong">
          {n.title}
        </h1>
        <p className="mt-6 text-[14px] text-neutral-500">{n.date}</p>

        <div className="mt-10 border-t border-line pt-10">
          <p className="text-[17px] leading-[1.8] text-neutral-500">{n.body}</p>
        </div>

        <div className="mt-14 border-t border-line pt-8">
          <Link
            href="/notices"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            <ArrowRight size={15} className="rotate-180" />
            공지사항 목록으로
          </Link>
        </div>
      </div>
    </section>
  );
}
