"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listProjects, listWinners, listExhibitions, type ArchivePublicItem } from "@/lib/api";
import { coverBg } from "@/lib/unsplash";
import type { Locale } from "@/lib/i18n";

// Public collection of COMPLETED projects (winners / exhibitions / all projects).
// These are project-level collections (per the archive contract), NOT per-winner
// rows — each card links to the full project archive. Live only; the static
// pages keep their own design in mock mode.

type Kind = "projects" | "winners" | "exhibitions";
const FETCH: Record<Kind, (o: { signal?: AbortSignal }) => Promise<Awaited<ReturnType<typeof listProjects>>>> = {
  projects: (o) => listProjects(o),
  winners: (o) => listWinners(o),
  exhibitions: (o) => listExhibitions(o),
};

function ProjectCard({ p, flip, locale }: { p: ArchivePublicItem; flip: boolean; locale: Locale }) {
  const ko = locale === "ko";
  const cover = p.hero.image;
  // location + a single year (period, else completionYear) — never a duplicate.
  const year = p.hero.period?.[locale] ?? (p.completionYear ? String(p.completionYear) : null);
  const meta = [p.hero.location?.[locale], year].filter(Boolean);
  return (
    <article className="grid items-center gap-8 border-b border-line py-14 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">{ko ? "완료 프로젝트" : "Completed project"}</p>
        <Link href={`/archive/${p.slug}`}>
          <h2
            className={`mt-4 text-[clamp(28px,3.4vw,40px)] font-bold leading-[1.15] text-ink-strong hover:text-brand-blue ${
              ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"
            }`}
          >
            {p.hero.program[locale]}
          </h2>
        </Link>
        <p className="mt-4 max-w-[34rem] text-[16px] leading-[1.8] text-ink-strong">{p.hero.summary[locale]}</p>
        {meta.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[16px] text-ink-strong">
            {meta.map((m, i) => <span key={i}>{m}</span>)}
          </div>
        )}
        <div className="mt-8">
          <Link
            href={`/archive/${p.slug}`}
            className="flex h-11 w-fit items-center justify-center gap-[10px] rounded-[7px] border border-black bg-white px-7 text-[14px] font-semibold text-ink hover:bg-neutral-50"
          >
            {ko ? "자세히 보기" : "View project"}
            <span aria-hidden>›</span>
          </Link>
        </div>
      </div>
      <Link href={`/archive/${p.slug}`} className={`block ${flip ? "lg:order-1" : ""}`}>
        <div
          className="aspect-[4/3] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5"
          style={{ backgroundImage: coverBg(p.slug, cover?.src ?? null) }}
          role="img"
          aria-label={cover ? cover.alt[locale] : p.hero.program[locale]}
        />
      </Link>
    </article>
  );
}

export default function ProjectCollectionView({ kind, locale, emptyText }: { kind: Kind; locale: Locale; emptyText: string }) {
  const [items, setItems] = useState<ArchivePublicItem[] | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    FETCH[kind]({}).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { setItems([...r.data.items]); setPhase("ready"); }
      else setPhase("error");
    });
    return () => { alive = false; };
  }, [kind, reloadKey]);

  const ko = locale === "ko";
  if (phase === "loading") return <p className="mx-auto max-w-page px-6 py-24 text-center text-[16px] text-ink-strong">{ko ? "불러오는 중…" : "Loading…"}</p>;
  if (phase === "error") return (
    <div className="mx-auto max-w-page px-6 py-24 text-center">
      <p className="text-[16px] text-ink-strong">{ko ? "불러오지 못했습니다." : "Could not load."}</p>
      <button onClick={() => { setPhase("loading"); setReloadKey((k) => k + 1); }} className="mt-4 rounded-[7px] border border-black px-6 py-2 text-[14px] font-semibold text-ink hover:bg-neutral-50">{ko ? "다시 시도" : "Retry"}</button>
    </div>
  );
  if (!items || items.length === 0) return <p className="mx-auto max-w-page px-6 py-24 text-center text-[16px] text-ink-strong">{emptyText}</p>;
  return (
    <section className="mx-auto max-w-page px-6">
      {items.map((p, i) => <ProjectCard key={p.id} p={p} flip={i % 2 === 1} locale={locale} />)}
    </section>
  );
}
