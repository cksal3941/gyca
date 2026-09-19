import SectionHeading from "./SectionHeading";
import type { Bi, Locale } from "@/lib/i18n";

type Media = {
  cat: Bi;
  title: Bi;
  sub: Bi;
  image: string;
};

const HEADING: Bi = { en: "Media Update", ko: "미디어 업데이트" };

const ITEMS: Media[] = [
  {
    cat: { en: "About", ko: "소개" },
    title: { en: "About GYCA Awards", ko: "GYCA AWARDS 소개" },
    sub: {
      en: "Meet GYCA, connecting young creators to the global stage.",
      ko: "청소년 창작자를 국제 무대로 잇는 GYCA 어워드를 소개합니다.",
    },
    image: "/images/media/dale-interview.jpg",
  },
  {
    cat: { en: "Guide", ko: "안내" },
    title: { en: "2027 Leipzig Exhibition Guide", ko: "2027 라이프치히 국제전시 안내" },
    sub: {
      en: "The international exhibition program for finalists in Leipzig.",
      ko: "Finalist 진출 작가를 위한 라이프치히 국제전시 프로그램을 안내합니다.",
    },
    image: "/images/media/billboard.jpg",
  },
  {
    cat: { en: "Guide", ko: "안내" },
    title: { en: "Submission Format Guide", ko: "아트북 출품 규격 안내" },
    sub: {
      en: "One cover image and a single PDF of 20+ pages including the cover.",
      ko: "표지 이미지 1장과 표지 포함 20쪽 이상 단일 PDF 등 제출 규격을 안내합니다.",
    },
    image: "/images/media/iyac-interview.jpg",
  },
];

function PlayIcon() {
  return (
    <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

export default function MediaUpdate({ locale }: { locale: Locale }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-page px-6">
        <SectionHeading badge="Media" title={HEADING[locale]} locale={locale} />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3">
          {ITEMS.map((m) => (
            <article key={m.title.en} className="group cursor-pointer">
              <div className="relative overflow-hidden bg-neutral-100">
                <div className="aspect-video w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.image}
                    alt={m.title[locale]}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <PlayIcon />
              </div>
              <h3 className="mt-4 text-[16px] font-medium leading-snug text-ink-strong group-hover:text-brand-blue">
                <span className="text-ink-strong">[{m.cat[locale]}]</span> {m.title[locale]}
              </h3>
              <p className="mt-2 text-[16px] leading-[1.6] text-ink-strong">{m.sub[locale]}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
