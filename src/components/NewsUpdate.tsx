import Link from "next/link";
import SectionHeading from "./SectionHeading";
import type { Bi, Locale } from "@/lib/i18n";

// All items are Leipzig 2027 announcements → link to the real competition detail
// (no dead "#" links).
const NEWS_HREF = "/contests/leipzig-2027";

type News = {
  tag?: Bi;
  tagColor?: string;
  title: Bi;
  date: string;
  no: string;
};

const HEADING: Bi = { en: "News Update", ko: "뉴스 업데이트" };

const NEWS: News[] = [
  {
    tag: { en: "New Award", ko: "대회 개최" },
    tagColor: "text-brand-blue",
    title: {
      en: "2027 GYCA International Youth Art Book Awards — entries open",
      ko: "2027 GYCA International Youth Art Book Awards 접수 시작",
    },
    date: "2026-09-14",
    no: "0001",
  },
  {
    tag: { en: "Guide", ko: "안내" },
    tagColor: "text-brand-blue",
    title: {
      en: "Submission format — single PDF 20+ pages incl. cover; English title & description required",
      ko: "출품 규격 안내 — 표지 포함 20쪽 이상 단일 PDF, 영문 작품명·소개 필수",
    },
    date: "2026-09-14",
    no: "0002",
  },
  {
    tag: { en: "Schedule", ko: "일정" },
    tagColor: "text-brand-orange",
    title: {
      en: "First international review & Official Selection announcement schedule",
      ko: "1차 국제심사 및 Official Selection 발표 일정 안내",
    },
    date: "2026-09-14",
    no: "0003",
  },
  {
    title: {
      en: "Finalist · Leipzig international exhibition (up to 30 works)",
      ko: "Finalist · 라이프치히 국제전시 안내 (최대 30작품)",
    },
    date: "2026-09-14",
    no: "0004",
  },
  {
    tag: { en: "Notice", ko: "공지" },
    tagColor: "text-ink-strong",
    title: {
      en: "Entry fee (€70 per work) & refund policy",
      ko: "참가비(작품당 €70) 및 환불 규정 안내",
    },
    date: "2026-09-14",
    no: "0005",
  },
];

export default function NewsUpdate({ locale }: { locale: Locale }) {
  return (
    <section className="bg-white pt-20 pb-24">
      <div className="mx-auto max-w-page px-6">
        <SectionHeading badge="News" title={HEADING[locale]} locale={locale} />
        <ul className="border-t border-ink/15">
          {NEWS.map((n) => (
            <li key={n.no}>
              <Link
                href={NEWS_HREF}
                className="group flex items-center gap-4 border-b border-line py-5 text-ink transition-colors hover:text-brand-blue"
              >
                {n.tag && (
                  <span
                    className={`hidden shrink-0 text-[16px] font-bold sm:inline ${n.tagColor}`}
                  >
                    [{n.tag[locale]}]
                  </span>
                )}
                <span className="flex-1 truncate text-[16px]">
                  {n.title[locale]}
                </span>
                <span className="shrink-0 text-[16px] tabular-nums text-ink-strong">
                  {n.date}
                </span>
                <span className="hidden w-14 shrink-0 text-right text-[16px] tabular-nums text-ink-strong sm:inline">
                  {n.no}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
