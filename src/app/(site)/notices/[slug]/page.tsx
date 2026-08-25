import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
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
    <>
      <PageHeader
        eyebrow={n.category}
        title={n.title}
        crumbs={[
          { label: "공지사항", href: "/notices" },
          { label: n.title },
        ]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <article className="max-w-[46rem]">
          <p className="text-[13px] text-neutral-500">{n.date}</p>
          <div className="mt-6 border-t border-line pt-8">
            <p className="text-[16px] leading-[1.8] text-neutral-500">
              {n.body}
            </p>
          </div>
          <div className="mt-10 border-t border-line pt-6">
            <Link
              href="/notices"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
            >
              <ArrowRight size={14} className="rotate-180" />
              공지사항 목록으로
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
