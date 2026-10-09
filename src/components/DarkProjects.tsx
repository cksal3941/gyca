export type Project = {
  badge: string;
  title: string[];
  desc: string;
  image: string;
  links: string[];
  reverse?: boolean;
};

function LinkRow({ label }: { label: string }) {
  return (
    <a
      href="#"
      className="group flex items-center gap-3 border-b border-white/15 py-4 text-[15px] text-white transition-colors hover:text-white"
    >
      <span className="font-medium">{label}</span>
      <span className="ml-auto translate-x-0 text-neutral-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white">
        →
      </span>
    </a>
  );
}

function ProjectBlock({ p }: { p: Project }) {
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24">
      {/* Image with counter overlay */}
      <div
        className={`relative overflow-hidden ${p.reverse ? "md:order-2" : ""}`}
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image}
            alt={p.title.join(" ")}
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
        <span className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 text-[12px] tabular-nums text-white">
          1 / 7
        </span>
      </div>

      {/* Text */}
      <div className={p.reverse ? "md:order-1" : ""}>
        <span className="inline-block bg-brand-blue px-[15px] py-[9px] text-[11px] font-bold leading-none tracking-wide text-white">
          {p.badge}
        </span>
        <h3 className="mt-6 font-title text-[24px] leading-[1.25] tracking-[-0.2px] text-white md:text-[30px]">
          {p.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p className="mt-5 max-w-md text-[14px] leading-7 text-neutral-400">
          {p.desc}
        </p>
        <div className="mt-8 max-w-sm">
          {p.links.map((l) => (
            <LinkRow key={l} label={l} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DarkProjects({ projects }: { projects: Project[] }) {
  if (!projects.length) return null;

  return (
    <section className="bg-black">
      {projects.map((p) => (
        <ProjectBlock key={p.title.join("")} p={p} />
      ))}
    </section>
  );
}
