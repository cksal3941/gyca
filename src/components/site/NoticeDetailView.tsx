"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getEditorialPublic } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import { getNotice, NOTICE_CATEGORY_LABEL } from "@/lib/site-data";
import type { Locale } from "@/lib/i18n";

// Notice detail (dual-mode). Live: published editorial by slug
// (GET /content/editorial/{slug}). Mock: static preview. Client component so the
// live fetch carries the session; a server component cannot forward the cookie.

type View = { catLabel: Record<Locale, string>; title: Record<Locale, string>; body: Record<Locale, string>; date: string };
type Phase = "loading" | "notfound" | "ready";

const CAT_LABEL: Record<string, Record<Locale, string>> = {
  notice: { en: "Notice", ko: "공지" }, schedule: { en: "Schedule", ko: "일정" }, faq: { en: "FAQ", ko: "FAQ" },
  news: { en: "News", ko: "뉴스" }, press: { en: "Press", ko: "보도" },
};

export default function NoticeDetailView({ slug }: { slug: string }) {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const [phase, setPhase] = useState<Phase>(isLive ? "loading" : "ready");
  const [view, setView] = useState<View | null>(() => {
    if (isLive) return null;
    const n = getNotice(slug);
    return n ? { catLabel: NOTICE_CATEGORY_LABEL[n.category], title: n.title, body: n.body, date: n.date } : null;
  });

  useEffect(() => {
    // Mock: initial state already resolved from site-data (the render handles a
    // missing item via the !view branch), so no fetch/setState needed.
    if (!isLive) return;
    let alive = true;
    getEditorialPublic(slug).then((r) => {
      if (!alive) return;
      if (r.kind === "success") {
        setView({ catLabel: CAT_LABEL[r.data.category] ?? { en: r.data.category, ko: r.data.category }, title: r.data.content.title, body: r.data.content.body, date: r.data.content.displayDate });
        setPhase("ready");
      } else setPhase("notfound");
    });
    return () => { alive = false; };
  }, [slug]);

  if (phase === "loading") {
    return <section className="mx-auto max-w-page px-6 py-16"><div className="mx-auto h-48 max-w-[46rem] animate-pulse rounded-2xl border border-line bg-surface" /></section>;
  }
  if (phase === "notfound" || !view) {
    return (
      <section className="mx-auto max-w-page px-6 py-16">
        <div className="mx-auto max-w-[46rem]">
          <p className="text-[16px] text-ink-strong">{ko ? "공지를 찾을 수 없습니다." : "Notice not found."}</p>
          <Link href="/notices" className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue">
            <span aria-hidden>‹</span>{ko ? "공지사항 목록으로" : "Back to notices"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <EditorialHeader
        eyebrow={view.catLabel[locale]}
        title={view.title[locale]}
        crumbs={[{ label: ko ? "공지사항" : "Notices", href: "/notices" }]}
        locale={locale}
      />
      <section className="mx-auto max-w-page px-6 py-16 lg:py-20">
        <div className="mx-auto max-w-[46rem]">
          <p className="text-[16px] text-ink-strong">{view.date}</p>
          <div className="mt-8 whitespace-pre-line border-t border-line pt-10">
            <p className="text-[16px] leading-[1.9] text-ink-strong">{view.body[locale]}</p>
          </div>
          <div className="mt-14 border-t border-line pt-8">
            <Link href="/notices" className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue">
              <span aria-hidden>‹</span>{ko ? "공지사항 목록으로" : "Back to notices"}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
