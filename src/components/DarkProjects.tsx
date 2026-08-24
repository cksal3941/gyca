type Project = {
  badge: string;
  title: string[];
  desc: string;
  image: string;
  links: string[];
  reverse?: boolean;
};

const PROJECTS: Project[] = [
  {
    badge: "예필로그",
    title: ["2026 카쟈: 한국 청소년 아트", "페스티벌 전시회"],
    desc: "마이슬라이드가 주최한 2026 카쟈 청소년 미술 대회의 1차 수상작들을 이어가던 전시회이며, 서울 인사동에 위치고 하고 있는 마루아트센터 특별관 에서 진행되었습니다. 컬러 세계 · 스타일로 · 회의워클 · 밀알복지재단이 함께 했습니다.",
    image: "https://picsum.photos/seed/graffiti-kid/900/900",
    links: ["예필로그", "수상작", "공고보기"],
  },
  {
    badge: "예필로그",
    title: ["2025 IYAC GLOBAL YOUTH ART CONTEST", "NEW YORK EXHIBITION"],
    desc: "전 세계적으로 진행된 청소년 미술 대회의 1차 수상작들을 이어가던 전시회이며, 뉴욕 맨해튼에 위치 하고 있는 Detour Gallery 에서 진행되었습니다. 분선에서 최종 선발된 5작품은 미국 뉴저지 상설전용관이 수여됩니다.",
    image: "https://picsum.photos/seed/ny-street-building/900/900",
    links: ["예필로그", "수상작", "공고보기"],
    reverse: true,
  },
];

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

export default function DarkProjects() {
  return (
    <section className="bg-black">
      {PROJECTS.map((p) => (
        <ProjectBlock key={p.title.join("")} p={p} />
      ))}
    </section>
  );
}
