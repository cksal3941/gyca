"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { NOTICES, NOTICE_FILTERS, type Notice } from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

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
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-ink-strong">
          {n.title}
        </span>
        <span
          className={`shrink-0 text-[20px] leading-none text-neutral-500 transition-transform ${
            open ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="pb-5 text-[15px] leading-[1.7] text-neutral-500">
          {n.body}
        </p>
      )}
    </div>
  );
}

export default function NoticesPage() {
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체"
      ? NOTICES
      : NOTICES.filter((n) => n.category === filter);
  const faqs = NOTICES.filter((n) => n.category === "FAQ");

  return (
    <>
      <PageHeader
        eyebrow="News & Notice"
        title="공지사항"
        description="GYCA 공모전 일정, 접수 안내, 자주 묻는 질문을 확인하세요."
        crumbs={[{ label: "공지사항" }]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="flex flex-wrap gap-2">
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

        {list.length > 0 ? (
          <ul className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
            {list.map((n, i) => (
              <li
                key={n.slug}
                className={i < list.length - 1 ? "border-b border-line" : ""}
              >
                <Link
                  href={`/notices/${n.slug}`}
                  className="group flex items-center gap-4 px-5 py-4"
                >
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white ${CATEGORY_COLOR[n.category]}`}
                  >
                    {n.category}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-strong group-hover:text-brand-blue">
                    {n.title}
                  </span>
                  <span className="shrink-0 text-[13px] text-neutral-500">
                    {n.date}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-16 text-center text-[15px] text-neutral-500">
            해당 분류의 공지가 아직 없습니다.
          </p>
        )}
      </section>

      {faqs.length > 0 && (
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-shell px-6 py-12">
            <h2 className="font-serif text-[24px] font-bold text-ink-strong">
              자주 묻는 질문 (FAQ)
            </h2>
            <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-white px-5">
              {faqs.map((n) => (
                <FaqItem key={n.slug} n={n} />
              ))}
            </div>
            <Link
              href="/contests"
              className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
            >
              공모전 보기
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
