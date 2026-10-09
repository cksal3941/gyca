"use client";

import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { Locale } from "@/lib/i18n";

// 법적 고지 문서(개인정보처리방침, 이용약관)의 공통 렌더러. 본문은 ko/en 두 언어를
// 같은 구조로 들고 있고, 현재 로케일에 맞는 쪽만 그린다. 목차는 섹션 제목에서 만든다.

export type LegalParagraph = string | { list: string[] };

export type LegalSection = {
  id: string;
  heading: Record<Locale, string>;
  body: Record<Locale, LegalParagraph[]>;
};

export type LegalDocumentData = {
  eyebrow: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  effectiveDate: string; // ISO date
  sections: LegalSection[];
};

function Paragraph({ p }: { p: LegalParagraph }) {
  if (typeof p === "string") {
    return <p className="break-keep text-[16px] leading-[1.9] text-ink-strong">{p}</p>;
  }
  return (
    <ul className="list-disc space-y-1.5 pl-6 text-[16px] leading-[1.9] text-ink-strong">
      {p.list.map((item, i) => (
        <li key={i} className="break-keep">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function LegalDocument({ doc }: { doc: LegalDocumentData }) {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const headingFont = ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]";
  const effective = new Date(doc.effectiveDate + "T00:00:00Z").toLocaleDateString(
    ko ? "ko-KR" : "en-GB",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" },
  );

  return (
    <>
      <EditorialHeader
        eyebrow={doc.eyebrow}
        title={doc.title[locale]}
        description={doc.description[locale]}
        crumbs={[{ label: doc.title[locale] }]}
        locale={locale}
      />

      <section className="mx-auto max-w-page px-6 pt-12 pb-12 lg:pt-16">
        <p className="text-[14px] uppercase tracking-[0.18em] text-ink">
          {ko ? "시행일" : "Effective"} · {effective}
        </p>

        <nav aria-label={ko ? "목차" : "Contents"} className="mt-8 max-w-[46rem]">
          <ol className="list-decimal space-y-1 pl-6 text-[15px] leading-[1.8] text-ink-strong">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="underline-offset-4 hover:underline">
                  {s.heading[locale]}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-14 max-w-[46rem] space-y-12">
          {doc.sections.map((s, i) => (
            <article key={s.id} id={s.id} className="scroll-mt-24">
              <h2
                className={`break-keep text-[clamp(20px,2.2vw,26px)] font-bold leading-snug text-ink-strong ${headingFont}`}
              >
                {i + 1}. {s.heading[locale]}
              </h2>
              <div className="mt-4 space-y-4">
                {s.body[locale].map((p, j) => (
                  <Paragraph key={j} p={p} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
