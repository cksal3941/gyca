import SectionHeading from "./SectionHeading";

export type Media = {
  cat: string;
  title: string;
  sub: string;
  image: string;
};

function PlayIcon() {
  return (
    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

export default function MediaUpdate({ items }: { items: Media[] }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-content px-6">
        <SectionHeading badge="Media" title="미디어 업데이트" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {items.map((m) => (
            <article key={m.title} className="group cursor-pointer">
              <div className="relative overflow-hidden bg-neutral-100">
                <div className="aspect-video w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.image}
                    alt={m.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <PlayIcon />
              </div>
              <h3 className="mt-4 text-[15px] font-medium leading-snug text-ink-strong group-hover:text-brand-blue">
                <span className="text-neutral-400">[{m.cat}]</span> {m.title}
              </h3>
              <p className="mt-2 text-[13px] leading-6 text-neutral-500">{m.sub}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
