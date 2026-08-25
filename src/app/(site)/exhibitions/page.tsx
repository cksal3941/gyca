"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import {
  EXHIBITIONS,
  EXHIBITION_FILTERS,
  type Exhibition,
} from "@/lib/site-data";
import { ArrowRight } from "@/components/landing/icons";

function ExhibitionCard({ e }: { e: Exhibition }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(17,17,17,0.4)]">
      <div
        className="h-[150px] w-full bg-cover bg-center"
        style={{ backgroundImage: e.tint }}
        role="img"
        aria-label={e.title}
      />
      <div className="flex flex-1 flex-col p-5">
        <span className="inline-flex w-fit items-center rounded-full border border-line px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-blue">
          {e.type}
        </span>
        <h3 className="mt-3 font-serif text-[18px] font-bold leading-snug text-ink-strong group-hover:text-brand-blue">
          {e.title}
        </h3>
        <p className="mt-1 text-[13px] text-neutral-500">
          {e.city} · {e.date}
        </p>
        <p className="mt-3 text-[14px] leading-[1.6] text-neutral-500">
          {e.summary}
        </p>
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4">
          <Link
            href={`/exhibitions/${e.slug}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-5 py-3 text-[14px] font-semibold text-white hover:-translate-y-0.5"
          >
            행사 소개
            <ArrowRight size={16} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href={`/exhibitions/${e.slug}#works`}
              className="text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
            >
              참여작 보기
            </Link>
            <Link
              href={`/exhibitions/${e.slug}#gallery`}
              className="text-[14px] font-semibold text-ink-strong hover:text-brand-blue"
            >
              사진·영상 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
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
      <PageHeader
        eyebrow="Exhibitions & Stages"
        title="전시·공연"
        description="프랑크푸르트·스폴레토·뉴욕 등 세계 무대에서 열리는 수상작 전시와 공연을 만나보세요."
        crumbs={[{ label: "전시·공연" }]}
      />
      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="flex flex-wrap gap-2">
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
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => (
              <ExhibitionCard key={e.slug} e={e} />
            ))}
          </div>
        ) : (
          <p className="mt-16 text-center text-[15px] text-neutral-500">
            해당 지역의 전시·공연이 아직 없습니다.
          </p>
        )}
      </section>
    </>
  );
}
