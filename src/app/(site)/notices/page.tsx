"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { NOTICES } from "@/lib/site-data";
import { listEditorialPublic } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import type { Locale } from "@/lib/i18n";

// Notices (dual-mode). Live: published editorial content (GET /content/editorial).
// Mock: the static preview samples. Same UI from a common item shape.

type Item = { key: string; catKey: string; title: Record<Locale, string>; body: Record<Locale, string>; date: string; href: string | null };

const CAT_LABEL: Record<string, Record<Locale, string>> = {
  notice: { en: "Notice", ko: "공지" }, schedule: { en: "Schedule", ko: "일정" }, faq: { en: "FAQ", ko: "FAQ" },
  news: { en: "News", ko: "뉴스" }, press: { en: "Press", ko: "보도" },
  // site-data KO categories
  공지: { en: "Notice", ko: "공지" }, 일정: { en: "Schedule", ko: "일정" }, FAQ: { en: "FAQ", ko: "FAQ" },
};
const CAT_COLOR: Record<string, string> = {
  notice: "bg-brand-blue", 공지: "bg-brand-blue", schedule: "bg-brand-orange", 일정: "bg-brand-orange",
  faq: "bg-neutral-700", FAQ: "bg-neutral-700", news: "bg-brand-blue", press: "bg-neutral-700",
};

function FaqItem({ n, locale }: { n: Item; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-6 py-6 text-left">
        <span className="font-title text-[clamp(20px,2.2vw,26px)] font-bold leading-snug tracking-[0.02em] text-ink-strong">{n.title[locale]}</span>
        <span className={`shrink-0 text-[24px] leading-none text-ink-strong transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && <p className="max-w-[46rem] pb-7 text-[16px] leading-[1.9] text-ink-strong">{n.body[locale]}</p>}
    </div>
  );
}

export default function NoticesPage() {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("all");
  const [items, setItems] = useState<Item[]>(
    isLive ? [] : NOTICES.map((n) => ({ key: n.slug, catKey: n.category, title: n.title, body: n.body, date: n.date, href: `/notices/${n.slug}` })),
  );
  const [loading, setLoading] = useState(isLive);

  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    listEditorialPublic(null, { limit: 50 }).then((r) => {
      if (!alive) return;
      if (r.kind === "success") {
        setItems(r.data.items.map((e) => ({
          key: e.id, catKey: e.category, title: e.content.title, body: e.content.body,
          date: e.content.displayDate, href: `/notices/${e.slug}`,
        })));
      }
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const faqs = items.filter((n) => n.catKey === "faq" || n.catKey === "FAQ");
  const nonFaq = items.filter((n) => n.catKey !== "faq" && n.catKey !== "FAQ");
  const cats = Array.from(new Set(nonFaq.map((n) => n.catKey)));
  const list = filter === "all" ? nonFaq : nonFaq.filter((n) => n.catKey === filter);

  return (
    <>
      <EditorialHeader
        eyebrow="News & Notice"
        title={locale === "ko" ? "공지사항" : "Notices"}
        description={locale === "ko"
          ? "GYCA 공모전 일정, 접수 안내, 자주 묻는 질문을 확인하세요."
          : "Find GYCA competition schedules, submission guidance, and frequently asked questions."}
        crumbs={[{ label: locale === "ko" ? "공지사항" : "Notices" }]}
        locale={locale}
      />

      <section className="mx-auto max-w-page px-6">
        {!isLive && (
          <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
            {locale === "ko"
              ? "아래 공지·일정은 디자인 데모용 예시입니다. 공식 일정은 Leipzig 2027 공모 안내를 따르세요."
              : "The notices below are demo placeholders. For official dates, see the Leipzig 2027 competition page."}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 -mx-6 border-b border-line px-6 py-6">
          {["all", ...cats].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                filter === f ? "border-black bg-black text-white" : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {f === "all" ? (locale === "ko" ? "전체" : "All") : CAT_LABEL[f]?.[locale] ?? f}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <p className="py-24 text-center text-[16px] text-ink-strong">{locale === "ko" ? "불러오는 중…" : "Loading…"}</p>
        ) : list.length > 0 ? (
          <div>
            {list.map((n) => {
              const inner = (
                <>
                  <span className={`shrink-0 px-[13px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white ${CAT_COLOR[n.catKey] ?? "bg-neutral-700"}`}>
                    {CAT_LABEL[n.catKey]?.[locale] ?? n.catKey}
                  </span>
                  <h2 className="min-w-0 flex-1 font-title text-[clamp(20px,2.2vw,26px)] font-bold leading-snug tracking-[0.02em] text-ink-strong group-hover:text-brand-blue">
                    {n.title[locale]}
                  </h2>
                  <span className="hidden shrink-0 text-[16px] text-ink-strong sm:block">{n.date}</span>
                </>
              );
              return n.href ? (
                <Link key={n.key} href={n.href} className="group flex items-center gap-5 border-b border-line py-8">{inner}</Link>
              ) : (
                <div key={n.key} className="group flex items-center gap-5 border-b border-line py-8">{inner}</div>
              );
            })}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko" ? "공지가 아직 없습니다." : "No notices yet."}
          </p>
        )}
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-page px-6">
          <div className="border-t border-line py-16 lg:py-24">
            <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">FAQ</p>
            <h2 className="mt-5 font-title text-[clamp(26px,2.8vw,36px)] font-bold leading-[1.1] tracking-[0.02em] text-ink-strong">
              {locale === "ko" ? "자주 묻는 질문" : "Frequently asked questions"}
            </h2>
            <div className="mt-10 border-t border-line">
              {faqs.map((n) => <FaqItem key={n.key} n={n} locale={locale} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
