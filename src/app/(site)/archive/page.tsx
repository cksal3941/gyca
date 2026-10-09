"use client";

import Link from "next/link";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { isLive } from "@/lib/api/mode";
import ProjectCollectionView from "@/components/archive/ProjectCollectionView";

// Completed-project archive index. Live: published projects (GET /content/projects).
// Mock: a pointer to the curated Klimt Villa archive (the design reference).

export default function ArchiveIndexPage() {
  const { locale } = useLocale();
  const ko = locale === "ko";
  return (
    <>
      <EditorialHeader
        eyebrow="Archive"
        title={ko ? "아카이브" : "Archive"}
        description={ko
          ? "완료된 국제 청소년 프로젝트의 선정작·전시·성과 기록입니다."
          : "A record of completed international youth projects — selections, exhibitions, and outcomes."}
        crumbs={[{ label: ko ? "아카이브" : "Archive" }]}
        locale={locale}
      />
      {isLive ? (
        <ProjectCollectionView
          kind="projects"
          locale={locale}
          emptyText={ko ? "공개된 프로젝트가 아직 없습니다." : "No projects published yet."}
        />
      ) : (
        <section className="mx-auto max-w-page px-6 py-16">
          <Link
            href="/archive/klimt-villa"
            className="inline-flex items-center gap-2 text-[16px] font-semibold text-ink-strong hover:text-brand-blue"
          >
            {ko ? "클림트 빌라 프로젝트 보기" : "View the Klimt Villa project"}
            <span aria-hidden>›</span>
          </Link>
        </section>
      )}
    </>
  );
}
