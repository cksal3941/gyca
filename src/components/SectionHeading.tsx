type Props = {
  badge: string;
  title: string;
};

/** Shared section header: colored badge + Korean title + "전체 보기" link. */
export default function SectionHeading({ badge, title }: Props) {
  return (
    <div className="mb-8 flex items-end justify-between">
      <div>
        <span className="inline-block bg-brand-blue px-[15px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-wide text-white">
          {badge}
        </span>
        <h2 className="mt-4 text-[24px] font-bold tracking-[-0.5px] text-ink-strong md:text-[28px]">
          {title}
        </h2>
      </div>
      <a
        href="#"
        className="group flex items-center gap-2 text-[13px] text-neutral-500 hover:text-ink"
      >
        전체 보기
        <span className="transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </a>
    </div>
  );
}
