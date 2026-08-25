"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import {
  CONTESTS,
  CONTEST_FILTERS,
  STATUS_LABEL,
  STATUS_COLOR,
  type Contest,
} from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

/** Status → primary action per the UX spec. */
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

function ContestCard({ c }: { c: Contest }) {
  const action = statusAction(c);
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(17,17,17,0.4)]">
      <Link href={`/contests/${c.slug}`} className="block">
        <div
          className="h-[150px] w-full bg-cover bg-center"
          style={{ backgroundImage: c.tint }}
          role="img"
          aria-label={c.title}
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-blue">
          {c.categoryEn}
        </p>
        <Link href={`/contests/${c.slug}`}>
          <h3 className="mt-2 font-serif text-[18px] font-bold leading-snug text-ink-strong group-hover:text-brand-blue">
            {c.title}
          </h3>
        </Link>
        <p className="mt-1 text-[13px] text-neutral-500">
          {c.city} · 마감 {c.deadline}
        </p>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-neutral-500">
          <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[c.status]}`} />
          {STATUS_LABEL[c.status]}
        </p>
        <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
          <Link
            href={`/contests/${c.slug}`}
            className="text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            자세히 보기
          </Link>
          <Link
            href={action.href}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-4 py-2 text-[13px] font-semibold text-white hover:-translate-y-0.5"
          >
            {action.label}
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ContestsPage() {
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체" ? CONTESTS : CONTESTS.filter((c) => c.category === filter);

  return (
    <>
      <PageHeader
        eyebrow="Contests"
        title="공모전"
        description="분야별 국제 청소년 공모전을 탐색하고, 접수 중인 공모전에 바로 지원하세요."
        crumbs={[{ label: "공모전" }]}
      />
      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="flex flex-wrap gap-2">
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
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <ContestCard key={c.slug} c={c} />
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-[15px] text-neutral-500">
            해당 분야의 공모전이 아직 없습니다.
          </p>
        )}
      </section>
    </>
  );
}
