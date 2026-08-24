import SectionHeading from "./SectionHeading";

type News = {
  tag?: string;
  tagColor?: string;
  title: string;
  date: string;
  no: string;
};

const NEWS: News[] = [
  {
    tag: "결과 공지",
    tagColor: "text-brand-orange",
    title: "2026 IYAC Global Art Contest 최종 결과 발표",
    date: "2026-08-08",
    no: "1445",
  },
  {
    title: "2026 KAJAA 아트페스티벌, 성공적인 개최와 아름다운 마무리",
    date: "2026-09-10",
    no: "1046",
  },
  {
    tag: "대회 개최",
    tagColor: "text-brand-blue",
    title: "2026 6th IYAC Global Youth Art Contest 개최",
    date: "2026-05-06",
    no: "1384",
  },
  {
    tag: "대회 개최",
    tagColor: "text-brand-blue",
    title: "2026 카쟈: 한국 청소년 아트 페스티벌 개최",
    date: "2026-03-04",
    no: "1590",
  },
  {
    tag: "공지 사항",
    tagColor: "text-neutral-500",
    title: "2026 6th IYAC Global Youth Art Contest 주제 및 일정 안내",
    date: "2025-11-03",
    no: "2077",
  },
];

export default function NewsUpdate() {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-content px-6">
        <SectionHeading badge="News" title="뉴스 업데이트" />
        <ul className="border-t border-ink/15">
          {NEWS.map((n) => (
            <li key={n.title}>
              <a
                href="#"
                className="group flex items-center gap-4 border-b border-line py-5 text-ink transition-colors hover:text-brand-blue"
              >
                {n.tag && (
                  <span
                    className={`hidden shrink-0 text-[13px] font-bold sm:inline ${n.tagColor}`}
                  >
                    [{n.tag}]
                  </span>
                )}
                <span className="flex-1 truncate text-[14px] md:text-[15px]">
                  {n.title}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-neutral-400">
                  {n.date}
                </span>
                <span className="hidden w-12 shrink-0 text-right text-[12px] tabular-nums text-neutral-300 sm:inline">
                  {n.no}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
