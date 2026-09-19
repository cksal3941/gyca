"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  NOTICES,
  NOTICE_FILTERS,
  NOTICE_CATEGORY_LABEL,
  type Notice,
} from "@/lib/site-data";
import type { Locale } from "@/lib/i18n";

const CATEGORY_COLOR: Record<Notice["category"], string> = {
  공지: "bg-brand-blue",
  일정: "bg-brand-orange",
  FAQ: "bg-neutral-700",
};

function FaqItem({ n, locale }: { n: Notice; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className="font-title text-[clamp(20px,2.2vw,26px)] font-bold leading-snug tracking-[0.02em] text-ink-strong">
          {n.title[locale]}
        </span>
        <span
          className={`shrink-0 text-[24px] leading-none text-ink-strong transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="max-w-[46rem] pb-7 text-[16px] leading-[1.9] text-ink-strong">
          {n.body[locale]}
        </p>
      )}
    </div>
  );
}

export default function NoticesPage() {
  const { locale } = useLocale();
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체" ? NOTICES : NOTICES.filter((n) => n.category === filter);
  const faqs = NOTICES.filter((n) => n.category === "FAQ");

  return (
    <>
      <EditorialHeader
        eyebrow="News & Notice"
        title={locale === "ko" ? "공지사항" : "Notices"}
        description={
          locale === "ko"
            ? "GYCA 공모전 일정, 접수 안내, 자주 묻는 질문을 확인하세요."
            : "Find GYCA competition schedules, submission guidance, and frequently asked questions."
        }
        crumbs={[{ label: locale === "ko" ? "공지사항" : "Notices" }]}
        locale={locale}
      />

      <section className="mx-auto max-w-page px-6">
        {/* Safety notice — sample announcements, not official schedules */}
        <div className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] leading-[1.6] text-ink-strong">
          {locale === "ko"
            ? "아래 공지·일정은 디자인 데모용 예시입니다. 공식 일정은 Leipzig 2027 공모 안내를 따르세요."
            : "The notices below are demo placeholders. For official dates, see the Leipzig 2027 competition page."}
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 -mx-6 border-b border-line px-6 py-6">
          {NOTICE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-[16px] font-medium transition-colors ${
                filter === f
                  ? "border-black bg-black text-white"
                  : "border-field text-ink hover:border-black hover:text-ink-strong"
              }`}
            >
              {NOTICE_CATEGORY_LABEL[f][locale]}
            </button>
          ))}
        </div>

        {/* List */}
        {list.length > 0 ? (
          <div>
            {list.map((n) => (
              <Link
                key={n.slug}
                href={`/notices/${n.slug}`}
                className="group flex items-center gap-5 border-b border-line py-8"
              >
                <span
                  className={`shrink-0 px-[13px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-[0.3px] text-white ${CATEGORY_COLOR[n.category]}`}
                >
                  {NOTICE_CATEGORY_LABEL[n.category][locale]}
                </span>
                <h2 className="min-w-0 flex-1 font-title text-[clamp(20px,2.2vw,26px)] font-bold leading-snug tracking-[0.02em] text-ink-strong group-hover:text-brand-blue">
                  {n.title[locale]}
                </h2>
                <span className="hidden shrink-0 text-[16px] text-ink-strong sm:block">
                  {n.date}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {locale === "ko"
              ? "해당 분류의 공지가 아직 없습니다."
              : "No notices in this category yet."}
          </p>
        )}
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-page px-6">
          <div className="border-t border-line py-16 lg:py-24">
            <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">
              FAQ
            </p>
            <h2 className="mt-5 font-title text-[clamp(26px,2.8vw,36px)] font-bold leading-[1.1] tracking-[0.02em] text-ink-strong">
              {locale === "ko" ? "자주 묻는 질문" : "Frequently asked questions"}
            </h2>

            <div className="mt-10 border-t border-line">
              {faqs.map((n) => (
                <FaqItem key={n.slug} n={n} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
