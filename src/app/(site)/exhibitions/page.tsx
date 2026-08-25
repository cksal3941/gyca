"use client";

import { useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import {
  EXHIBITIONS,
  EXHIBITION_FILTERS,
  type Exhibition,
} from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

function ExhibitionRow({ e, flip }: { e: Exhibition; flip: boolean }) {
  return (
    <article className="grid items-center gap-8 border-b border-line py-12 lg:grid-cols-2 lg:gap-16">
      {/* Text */}
      <div className={flip ? "lg:order-2" : ""}>
        <p className="inline-flex items-center rounded-full border border-line px-3 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-brand-blue">
          {e.type}
        </p>
        <Link href={`/exhibitions/${e.slug}`}>
          <h2 className="mt-3 font-serif text-[clamp(30px,3.6vw,40px)] leading-[1.2] tracking-[0.01em] text-ink-strong hover:text-brand-blue">
            {e.title}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[14px] leading-[1.9] text-neutral-500">
          {e.summary}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-neutral-500">
          <span>{e.city}</span>
          <span>{e.date}</span>
        </div>
        <div className="mt-7 flex items-center gap-4">
          <Link
            href={`/exhibitions/${e.slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white hover:-translate-y-0.5"
          >
            행사 소개
            <ArrowRight size={15} />
          </Link>
          <Link
            href={`/exhibitions/${e.slug}#works`}
            className="text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            참여작 보기
          </Link>
        </div>
      </div>

      {/* Image */}
      <Link
        href={`/exhibitions/${e.slug}`}
        className={`block ${flip ? "lg:order-1" : ""}`}
      >
        <div
          className="aspect-[4/3] w-full rounded-2xl bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: e.tint }}
          role="img"
          aria-label={e.title}
        />
      </Link>
    </article>
  );
}

export default function ExhibitionsPage() {
  const [filter, setFilter] = useState<string>("전체");
  const list =
    filter === "전체"
      ? EXHIBITIONS
      : EXHIBITIONS.filter((e) => e.city === filter);

  return (
    <>
      <EditorialHeader
        eyebrow="Exhibitions & Stages"
        title="전시·공연"
        description="프랑크푸르트·스폴레토·뉴욕 등 세계 무대에서 열리는 수상작 전시와 공연을 만나보세요."
        crumbs={[{ label: "전시·공연" }]}
      />
      <section className="mx-auto max-w-shell px-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 border-b border-line py-6">
          {EXHIBITION_FILTERS.map((f) => (
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
            {list.map((e, i) => (
              <ExhibitionRow key={e.slug} e={e} flip={i % 2 === 1} />
            ))}
          </div>
        ) : (
          <p className="py-24 text-center text-[15px] text-neutral-500">
            해당 지역의 전시·공연이 아직 없습니다.
          </p>
        )}
      </section>
    </>
  );
}
