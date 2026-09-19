import Link from "next/link";
import type { Bi, BiLines, Locale } from "@/lib/i18n";
import { KLIMT_ARCHIVE_HREF } from "@/lib/content/leipzig-home";

type ProjectLink = Bi & { href: string };

type Project = {
  badge: Bi;
  title: BiLines;
  desc: Bi;
  image: string;
  links: ProjectLink[];
  reverse?: boolean;
};

// Klimt Villa — completed project shown as Archive / Success Case (NOT a new
// open call). Described in general terms; no unverified figures are invented.
const PROJECTS: Project[] = [
  {
    badge: { en: "Archive", ko: "아카이브" },
    title: {
      en: ["Klimt Villa Youth Art Award", "Vienna Exhibition"],
      ko: ["클림트 빌라 청소년 미술상", "비엔나 전시"],
    },
    desc: {
      en: "A completed project run from the open call through selection to the Vienna exhibition and award ceremony, where selected young artists' works were shown. Presented as a flagship completed case — not a new open call.",
      ko: "공모부터 선정, 비엔나 현지 전시와 수여식까지 운영한 완료 프로젝트입니다. 선정된 청소년 작가들의 작품을 비엔나에서 선보였습니다. 신규 모집 대상이 아닌 대표 완료 사례로 소개합니다.",
    },
    image: "/images/projects/iyac-newyork.jpg",
    links: [
      { en: "View project", ko: "프로젝트 보기", href: KLIMT_ARCHIVE_HREF },
      { en: "Exhibition archive", ko: "전시 아카이브", href: `${KLIMT_ARCHIVE_HREF}#exhibition_photos` },
      { en: "Exhibition certificate", ko: "전시 인증서", href: `${KLIMT_ARCHIVE_HREF}#exhibition_certificate` },
    ],
  },
  {
    badge: { en: "Archive", ko: "아카이브" },
    title: {
      en: ["Klimt Villa", "Sales · Archive"],
      ko: ["클림트 빌라", "작품 판매 · 아카이브"],
    },
    desc: {
      en: "Following the exhibition, this completed case continued through artwork sales, buyer interviews, and exhibition and sales certificates. It is an archive of past operations, not a new sales feature.",
      ko: "전시에 이어 작품 판매와 구매자 인터뷰, 전시·판매 인증서 발급까지 이어진 완료 사례입니다. 실제 판매 기능을 새로 여는 것이 아니라, 운영 실적을 소개하는 아카이브입니다.",
    },
    image: "/images/projects/kajaa-exhibition.jpg",
    links: [
      { en: "Buyer interviews", ko: "구매자 인터뷰", href: `${KLIMT_ARCHIVE_HREF}#buyer_interviews` },
      { en: "Sales certificate", ko: "판매 인증서", href: `${KLIMT_ARCHIVE_HREF}#sales_certificate` },
      { en: "Archive", ko: "아카이브", href: KLIMT_ARCHIVE_HREF },
    ],
    reverse: true,
  },
];

function LinkRow({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 border-b border-white/15 py-4 text-[15px] text-white transition-colors hover:text-white"
    >
      <span className="font-medium">{label}</span>
      <span className="ml-auto translate-x-0 text-neutral-400 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-white">
        →
      </span>
    </Link>
  );
}

function ProjectBlock({ p, locale }: { p: Project; locale: Locale }) {
  return (
    <div className="mx-auto grid max-w-page grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-24">
      {/* Image with counter overlay */}
      <div className={`relative overflow-hidden ${p.reverse ? "md:order-2" : ""}`}>
        <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image}
            alt={p.title[locale].join(" ")}
            className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
        <span className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 text-[12px] tabular-nums text-white">
          {p.badge[locale]}
        </span>
      </div>

      {/* Text */}
      <div className={p.reverse ? "md:order-1" : ""}>
        <span className="inline-block bg-brand-blue px-[15px] py-[9px] text-[11px] font-bold uppercase leading-none tracking-wide text-white">
          {p.badge[locale]}
        </span>
        <h3 className="mt-6 font-title text-[24px] leading-[1.25] tracking-[0.5px] text-white md:text-[30px]">
          {p.title[locale].map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p className="mt-5 max-w-md text-[14px] leading-7 text-neutral-400">
          {p.desc[locale]}
        </p>
        <div className="mt-8 max-w-sm">
          {p.links.map((linkItem) => (
            <LinkRow key={linkItem.en} label={linkItem[locale]} href={linkItem.href} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DarkProjects({ locale }: { locale: Locale }) {
  return (
    <section className="bg-black">
      {PROJECTS.map((p) => (
        <ProjectBlock key={p.title.en.join("")} p={p} locale={locale} />
      ))}
    </section>
  );
}
