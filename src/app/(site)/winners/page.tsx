"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import {
  WINNERS,
  WINNER_YEARS,
  AWARD_LEVELS,
  CONTEST_FILTERS,
  AWARD_COLOR,
  type Winner,
} from "@/lib/site-data";

function WinnerItem({ w }: { w: Winner }) {
  return (
    <Link href={`/winners/${w.slug}`} className="group block">
      <div
        className="aspect-[4/5] w-full rounded-2xl bg-cover bg-center ring-1 ring-black/5"
        style={{ backgroundImage: w.tint }}
        role="img"
        aria-label={w.title}
      />
      <p className="mt-5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-strong">
        <span className={`h-2.5 w-2.5 rounded-full ${AWARD_COLOR[w.award]}`} />
        {w.award}
      </p>
      <h3 className="mt-2 font-serif text-[clamp(20px,2.2vw,26px)] font-bold leading-tight text-ink-strong group-hover:text-brand-blue">
        {w.title}
      </h3>
      <p className="mt-2 text-[14px] text-neutral-500">
        {w.artist} · {w.country} · {w.year}
      </p>
    </Link>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-16 shrink-0 text-[13px] font-semibold text-ink-strong">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${
            value === o
              ? "border-brand-blue bg-brand-blue text-white"
              : "border-line text-ink hover:border-brand-blue hover:text-brand-blue"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function WinnersPage() {
  const [year, setYear] = useState<string>("전체");
  const [award, setAward] = useState<string>("전체");
  const [category, setCategory] = useState<string>("전체");
  const [query, setQuery] = useState<string>("");

  const q = query.trim().toLowerCase();
  const list = WINNERS.filter((w) => {
    if (year !== "전체" && w.year !== year) return false;
    if (award !== "전체" && w.award !== award) return false;
    if (category !== "전체" && w.category !== category) return false;
    if (
      q &&
      ![w.title, w.artist, w.country, w.category].some((f) =>
        f.toLowerCase().includes(q)
      )
    )
      return false;
    return true;
  });

  return (
    <>
      <EditorialHeader
        eyebrow="Winners"
        title="수상작"
        description="역대 국제 청소년 공모전 수상작을 연도·수상 등급·부문별로 살펴보세요."
        crumbs={[{ label: "수상작" }]}
      />
      <section className="mx-auto max-w-shell px-6">
        {/* Filters */}
        <div className="space-y-4 border-b border-line py-6">
          <FilterRow
            label="연도"
            options={WINNER_YEARS}
            value={year}
            onChange={setYear}
          />
          <FilterRow
            label="수상"
            options={AWARD_LEVELS}
            value={award}
            onChange={setAward}
          />
          <FilterRow
            label="부문"
            options={CONTEST_FILTERS}
            value={category}
            onChange={setCategory}
          />
          <div className="pt-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="참가자 이름, 접수번호, 작품명, 국가, 부문"
              className="w-full rounded-lg border border-line px-4 py-3 text-[14px] text-ink-strong placeholder:text-neutral-400 focus:border-brand-blue focus:outline-none"
            />
          </div>
        </div>

        {list.length > 0 ? (
          <div className="grid gap-x-10 gap-y-16 py-14 sm:grid-cols-2">
            {list.map((w) => (
              <WinnerItem key={w.slug} w={w} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[15px] text-neutral-500">
            조건에 맞는 수상작이 없습니다.
          </p>
        )}
      </section>
    </>
  );
}
