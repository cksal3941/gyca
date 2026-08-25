"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import {
  CONTESTS,
  CONTEST_FILTERS,
  STATUS_LABEL,
  STATUS_COLOR,
  type Contest,
} from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

function statusAction(c: Contest): { label: string; href: string } {
  switch (c.status) {
    case "upcoming":
      return { label: "일정 확인", href: `/contests/${c.slug}#schedule` };
    case "open":
      return { label: "접수하기", href: `/submit?contest=${c.slug}` };
    case "judging":
      return { label: "접수 확인", href: "/mypage" };
    case "result":
      return { label: "결과 보기", href: `/contests/${c.slug}#result` };
    case "closed":
      return { label: "수상작 보기", href: `/winners?year=${c.deadline.slice(0, 4)}` };
  }
}

function ContestRow({ c, flip }: { c: Contest; flip: boolean }) {
  const action = statusAction(c);
  return (
    <article className="grid items-center gap-8 border-b border-line py-12 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div className={flip ? "lg:order-2" : ""}>
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-blue">
          {c.categoryEn}
        </p>
        <Link href={`/contests/${c.slug}`}>
          <h2 className="mt-3 font-serif text-[clamp(26px,3vw,36px)] font-bold leading-tight text-ink-strong hover:text-brand-blue">
            {c.title}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[15px] leading-[1.7] text-neutral-500">
          {c.summary}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-neutral-500">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.status]}`} />
            {STATUS_LABEL[c.status]}
          </span>
          <span>{c.city}</span>
          <span>접수 {c.period}</span>
        </div>
        <div className="mt-7 flex items-center gap-4">
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white hover:-translate-y-0.5"
          >
            {action.label}
            <ArrowRight size={15} />
          </Link>
          <Link
            href={`/contests/${c.slug}`}
            className="text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            자세히 보기
          </Link>
        </div>
      </div>

      {/* Image */}
      <Link
        href={`/contests/${c.slug}`}
        className={`block ${flip ? "lg:order-1" : ""}`}
      >
        <div
          className="aspect-[4/3] w-full rounded-2xl bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: c.tint }}
          role="img"
          aria-label={c.title}
        />
      </Link>
    </article>
  );
}

export default function ContestsPage() {
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체" ? CONTESTS : CONTESTS.filter((c) => c.category === filter);

  return (
    <>
      <EditorialHeader
        eyebrow="Contests"
        title="공모전"
        description="분야별 국제 청소년 공모전을 탐색하고, 접수 중인 공모전에 바로 지원하세요."
        crumbs={[{ label: "공모전" }]}
      />
      <section className="mx-auto max-w-shell px-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-line py-6">
          {CONTEST_FILTERS.map((f) => (
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
          <div>
            {list.map((c, i) => (
              <ContestRow key={c.slug} c={c} flip={i % 2 === 1} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[15px] text-neutral-500">
            해당 분야의 공모전이 아직 없습니다.
          </p>
        )}
      </section>
    </>
  );
}
