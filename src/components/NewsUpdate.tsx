import Link from "next/link";
import SectionHeading from "./SectionHeading";
import type { Bi, Locale } from "@/lib/i18n";

// All items are VIYBA 2026 announcements → link to the real competition detail
// (no dead "#" links). NOTE: publish dates below are editorial placeholders —
// replace with the real announcement dates before launch.
const NEWS_HREF = "/contests/viyba-2026";

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
      en: "VIYBA 2026 — Vienna International Youth Book Awards now open (deadline 7 Nov 2026)",
      ko: "VIYBA 2026 비엔나 국제 청소년 북 어워드 접수 중 (마감 2026.11.07)",
    },
    date: "2026-10-01",
    no: "0001",
  },
  {
    tag: { en: "Schedule", ko: "일정" },
    tagColor: "text-brand-orange",
    title: {
      en: "Vienna Final — 14–16 Dec 2026",
      ko: "비엔나 본선 안내 — 2026.12.14~16",
    },
    date: "2026-10-01",
    no: "0002",
  },
  {
    tag: { en: "Guide", ko: "안내" },
    tagColor: "text-brand-blue",
    title: {
      en: "A book you can read, touch, and experience — judged as a work of art",
      ko: "읽고, 만지고, 경험하는 책 한 권을 예술작품으로 평가합니다",
    },
    date: "2026-10-01",
    no: "0003",
  },
  {
    tag: { en: "How to apply", ko: "접수 방법" },
    tagColor: "text-ink-strong",
    title: {
      en: "Entries are accepted through the official application form",
      ko: "공식 접수 양식(구글폼)을 통해 작품을 접수합니다",
    },
    date: "2026-10-01",
    no: "0004",
  },
  {
    tag: { en: "Notice", ko: "공지" },
    tagColor: "text-ink-strong",
    title: {
      en: "Entry fee ₩150,000 per work & refund policy",
      ko: "참가비(작품당 ₩150,000) 및 환불 규정 안내",
    },
    date: "2026-10-01",
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
