"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { getProject, type ArchivePublicItem } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import type { Locale } from "@/lib/i18n";
import type { ArchiveSectionKind } from "@/contracts/project-archive";

// Public completed-project archive detail. Live: GET /content/projects/{slug}.
// Sections render by order; pending sections show only title + note (the server
// strips their unfinished payload). Mock mode has no live data — this view is
// used for the live archive; the curated Klimt page stays separate.

const SECTION_EYEBROW: Record<ArchiveSectionKind, { en: string; ko: string }> = {
  intro: { en: "Introduction", ko: "소개" },
  process: { en: "Process", ko: "진행 과정" },
  selection: { en: "Selected works", ko: "선정작" },
  exhibition_photos: { en: "Exhibition", ko: "전시" },
  ceremony_photos: { en: "Ceremony", ko: "시상식" },
  sales: { en: "Sales", ko: "판매" },
  buyer_interviews: { en: "Interviews", ko: "인터뷰" },
  exhibition_certificate: { en: "Exhibition certificate", ko: "전시 인증" },
  sales_certificate: { en: "Sales certificate", ko: "판매 인증" },
  results: { en: "Results", ko: "결과" },
};

type Section = ArchivePublicItem["sections"][number];

function SectionBlock({ s, locale }: { s: Section; locale: Locale }) {
  const ko = locale === "ko";
  const eyebrow = SECTION_EYEBROW[s.kind]?.[ko ? "ko" : "en"] ?? s.kind;
  return (
    <section className="border-t border-line py-14">
      <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">{eyebrow}</p>
      <h2 className={`mt-4 break-keep text-[clamp(24px,2.6vw,34px)] font-bold leading-[1.15] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>{s.title[locale]}</h2>
      {s.status === "pending" ? (
        <p className="mt-5 text-[16px] leading-[1.8] text-ink-strong/70">
          {s.pendingNote ? s.pendingNote[locale] : ko ? "자료 준비 중입니다." : "Materials are being prepared."}
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-8">
          {s.intro && <p className="max-w-[46rem] whitespace-pre-line text-[16px] leading-[1.9] text-ink-strong">{s.intro[locale]}</p>}
          {s.gallery.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {s.gallery.map((m, i) => (
                <figure key={i} className="flex flex-col gap-2">
                  <div className="aspect-[4/3] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5" style={{ backgroundImage: `url(${m.src})` }} role="img" aria-label={m.alt[locale]} />
                  {m.caption && <figcaption className="text-[15px] text-ink-strong/70">{m.caption[locale]}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          {s.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {s.stats.map((st, i) => (
                <div key={i} className="rounded-2xl border border-line bg-surface p-5">
                  <div className={`text-[28px] font-bold text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{st.value[locale]}</div>
                  <div className="mt-1 text-[15px] text-ink-strong/70">{st.label[locale]}</div>
                </div>
              ))}
            </div>
          )}
          {s.quotes.length > 0 && (
            <div className="flex flex-col gap-6">
              {s.quotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-brand-blue pl-5">
                  <p className="text-[18px] leading-[1.7] text-ink-strong">“{q.quote[locale]}”</p>
                  <cite className="mt-2 block text-[15px] not-italic text-ink-strong/70">— {q.attribution[locale]}</cite>
                </blockquote>
              ))}
            </div>
          )}
          {s.documents.length > 0 && (
            <ul className="flex flex-col gap-2">
              {s.documents.map((d, i) => (
                <li key={i}>
                  <a href={d.src} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue">
                    <span aria-hidden>↗</span>{d.alt[locale]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default function ArchivePublicView({ slug }: { slug: string }) {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const [phase, setPhase] = useState<"loading" | "notfound" | "error" | "ready">(isLive ? "loading" : "notfound");
  const [proj, setProj] = useState<ArchivePublicItem | null>(null);

  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    getProject(slug).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { setProj(r.data); setPhase("ready"); }
      else if (r.kind === "error" && r.code === "NOT_FOUND") setPhase("notfound");
      else setPhase("error");
    });
    return () => { alive = false; };
  }, [slug]);

  if (phase === "loading") {
    return <section className="mx-auto max-w-page px-6 py-16"><div className="mx-auto h-64 max-w-[52rem] animate-pulse rounded-2xl border border-line bg-surface" /></section>;
  }
  if (phase === "notfound" || phase === "error" || !proj) {
    return (
      <section className="mx-auto max-w-page px-6 py-16">
        <p className="text-[16px] text-ink-strong">{phase === "error" ? (ko ? "불러오지 못했습니다." : "Could not load.") : ko ? "프로젝트를 찾을 수 없습니다." : "Project not found."}</p>
        <Link href="/archive" className="mt-6 inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"><span aria-hidden>‹</span>{ko ? "아카이브로" : "Back to archive"}</Link>
      </section>
    );
  }

  const sections = [...proj.sections].sort((a, b) => a.order - b.order);
  return (
    <>
      <EditorialHeader
        eyebrow="Archive"
        title={proj.hero.program[locale]}
        description={proj.hero.summary[locale]}
        crumbs={[{ label: ko ? "아카이브" : "Archive", href: "/archive" }]}
        locale={locale}
      />
      <article className="mx-auto max-w-page px-6 py-16 lg:py-20">
        {proj.hero.image && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-cover bg-center ring-1 ring-black/5" style={{ backgroundImage: `url(${proj.hero.image.src})` }} role="img" aria-label={proj.hero.image.alt[locale]} />
        )}
        <div className={proj.hero.image ? "mt-10" : ""}>
          {sections.map((s) => <SectionBlock key={`${s.kind}-${s.order}`} s={s} locale={locale} />)}
        </div>
      </article>
    </>
  );
}
