import Link from "next/link";
import { notFound } from "next/navigation";
import { getNotice, NOTICES, NOTICE_CATEGORY_LABEL } from "@/lib/site-data";
import { getServerLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return NOTICES.map((n) => ({ slug: n.slug }));
}

export default async function NoticeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale: Locale = await getServerLocale();
  const n = getNotice(slug);
  if (!n) notFound();

  const ko = locale === "ko";

  return (
    <section className="mx-auto max-w-page px-6 py-16 lg:py-24">
      <div className="mx-auto max-w-[46rem]">
        <nav className="mb-10 flex flex-wrap items-center gap-1.5 text-[16px] text-ink-strong">
          <Link href="/" className="hover:text-brand-blue">
            {ko ? "홈" : "Home"}
          </Link>
          <span className="text-line">/</span>
          <Link href="/notices" className="hover:text-brand-blue">
            {ko ? "공지사항" : "Notices"}
          </Link>
          <span className="text-line">/</span>
          <span className="text-ink-strong">{n.title[locale]}</span>
        </nav>

        <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
          {NOTICE_CATEGORY_LABEL[n.category][locale]}
        </p>
        <h1 className="mt-4 font-title font-bold text-[clamp(40px,5vw,64px)] leading-[1.05] tracking-[0.02em] text-ink-strong">
          {n.title[locale]}
        </h1>
        <p className="mt-6 text-[16px] text-ink-strong">{n.date}</p>

        <div className="mt-10 border-t border-line pt-10">
          <p className="text-[16px] leading-[1.9] text-ink-strong">{n.body[locale]}</p>
        </div>

        <div className="mt-14 border-t border-line pt-8">
          <Link
            href="/notices"
            className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            <span aria-hidden>‹</span>
            {ko ? "공지사항 목록으로" : "Back to notices"}
          </Link>
        </div>
      </div>
    </section>
  );
}
