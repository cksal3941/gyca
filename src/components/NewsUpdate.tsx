import SectionHeading from "./SectionHeading";

export type News = {
  tag?: string;
  tagColor?: string;
  title: string;
  date: string;
  no: string;
};

export default function NewsUpdate({ items }: { items: News[] }) {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-content px-6">
        <SectionHeading badge="News" title="뉴스 업데이트" />
        <ul className="border-t border-ink/15">
          {items.map((n) => (
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
