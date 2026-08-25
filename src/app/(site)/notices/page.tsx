"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { NOTICES, NOTICE_FILTERS, type Notice } from "@/lib/site-data";

const CATEGORY_COLOR: Record<Notice["category"], string> = {
  공지: "bg-brand-blue",
  일정: "bg-brand-teal",
  FAQ: "bg-brand-purple",
};

function FaqItem({ n }: { n: Notice }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className="font-serif text-[clamp(18px,1.8vw,22px)] font-bold leading-snug text-ink-strong">
          {n.title}
        </span>
        <span
          className={`shrink-0 text-[24px] leading-none text-neutral-400 transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="max-w-[46rem] pb-7 text-[16px] leading-[1.8] text-neutral-500">
          {n.body}
        </p>
      )}
    </div>
  );
}

export default function NoticesPage() {
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체" ? NOTICES : NOTICES.filter((n) => n.category === filter);
  const faqs = NOTICES.filter((n) => n.category === "FAQ");

  return (
    <>
      <EditorialHeader
        eyebrow="News & Notice"
        title="공지사항"
        description="GYCA 공모전 일정, 접수 안내, 자주 묻는 질문을 확인하세요."
        crumbs={[{ label: "공지사항" }]}
      />

      <section className="mx-auto max-w-shell px-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-line py-6">
          {NOTICE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
                filter === f
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-line text-ink hover:border-brand-blue hover:text-brand-blue"
              }`}
            >
              {f}
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
                className="group flex items-center gap-6 border-b border-line py-8"
              >
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold text-white ${CATEGORY_COLOR[n.category]}`}
                >
                  {n.category}
                </span>
                <h2 className="min-w-0 flex-1 font-serif text-[clamp(19px,2vw,26px)] font-bold leading-snug text-ink-strong group-hover:text-brand-blue">
                  {n.title}
                </h2>
                <span className="hidden shrink-0 text-[14px] text-neutral-500 sm:block">
                  {n.date}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[15px] text-neutral-500">
            해당 분류의 공지가 아직 없습니다.
          </p>
        )}
      </section>

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-shell px-6">
          <div className="border-t border-line py-16 lg:py-24">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-brand-blue">
              FAQ
            </p>
            <h2 className="mt-5 font-serif text-[clamp(26px,3vw,38px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink-strong">
              자주 묻는 질문
            </h2>

            <div className="mt-10 border-t border-line">
              {faqs.map((n) => (
                <FaqItem key={n.slug} n={n} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
