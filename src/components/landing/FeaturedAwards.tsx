import type { ComponentType } from "react";
import {
  ArrowRight,
  Asterisk,
  Calendar,
  Users,
  Globe,
  Award,
} from "./icons";

type Award = {
  image: string;
  tint: string;
  title: string[];
  tags: string;
  tagColor: string;
  status: string;
  statusColor: string;
};

const AWARDS: Award[] = [
  {
    image: "/images/awards/klimt.jpg",
    tint: "linear-gradient(135deg,#efd189,#c68f2c)",
    title: ["International Klimt", "Youth Award"],
    tags: "Art · Youth",
    tagColor: "text-brand-teal",
    status: "Preliminary Round Open",
    statusColor: "bg-brand-teal",
  },
  {
    image: "/images/awards/bach.jpg",
    tint: "linear-gradient(135deg,#7a4b2b,#1b1b1b)",
    title: ["Bach Festival", "International Competition"],
    tags: "Music · Performance",
    tagColor: "text-brand-blue",
    status: "Applications Open",
    statusColor: "bg-brand-teal",
  },
  {
    image: "/images/awards/viyba.jpg",
    tint: "linear-gradient(135deg,#e6e6e6,#a6a6a6)",
    title: ["VIYBA Vienna International", "Youth Book Award"],
    tags: "Book · Illustration",
    tagColor: "text-brand-blue",
    status: "Pre-registration Open",
    statusColor: "bg-brand-blue",
  },
];

function AwardCard({ award }: { award: Award }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(17,17,17,0.4)]">
      <div
        className="h-[150px] w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${award.image}), ${award.tint}` }}
        role="img"
        aria-label={award.title.join(" ")}
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-serif text-[19px] font-bold leading-snug text-ink-strong">
          {award.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p
          className={`mt-2 text-[16px] font-bold uppercase tracking-[0.12em] ${award.tagColor}`}
        >
          {award.tags}
        </p>
        <p className="mt-3 flex items-center gap-2 text-[16px] text-ink-strong">
          <span className={`h-2 w-2 rounded-full ${award.statusColor}`} />
          {award.status}
        </p>
        <a
          href="#"
          className="mt-5 inline-flex items-center gap-1.5 border-t border-line pt-4 text-[16px] font-semibold text-ink-strong group-hover:text-brand-blue"
        >
          View Award
          <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}

type CalendarRow = {
  months: string;
  title: string;
  sub: string;
  dot: string;
  Icon: ComponentType<{ size?: number }>;
};

const CALENDAR: CalendarRow[] = [
  {
    months: "MAY–JUL",
    title: "Preliminary Round Applications",
    sub: "Applications for each international award",
    dot: "bg-brand-blue",
    Icon: Calendar,
  },
  {
    months: "AUG–SEP",
    title: "Preliminary Round Judging",
    sub: "Professional jury review and results",
    dot: "bg-brand-purple",
    Icon: Users,
  },
  {
    months: "OCT–DEC",
    title: "International Finals",
    sub: "Overseas finals and final judging",
    dot: "bg-brand-teal",
    Icon: Globe,
  },
  {
    months: "JAN–MAR",
    title: "Awards & Certification",
    sub: "Verified certificates and achievement records",
    dot: "bg-brand-blue",
    Icon: Award,
  },
];

function AnnualCalendar() {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-[26px] font-bold tracking-[-0.01em] text-ink-strong">
          Annual Calendar
        </h2>
        <a
          href="#"
          className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-brand-blue"
        >
          View Full Calendar
          <ArrowRight size={15} />
        </a>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white">
        {CALENDAR.map((row, i) => (
          <div
            key={row.months}
            className={`flex items-center gap-4 px-5 py-4 ${
              i < CALENDAR.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`} />
            <span className="w-[62px] shrink-0 text-[16px] font-bold tracking-[0.01em] text-ink-strong">
              {row.months}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-snug text-ink-strong">
                {row.title}
              </p>
              <p className="mt-0.5 text-[16px] leading-snug text-ink-strong">
                {row.sub}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
              <row.Icon size={16} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FeaturedAwards() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-shell gap-10 px-6 py-20 lg:grid-cols-3">
        {/* Featured awards — 2/3 */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-[26px] font-bold tracking-[-0.01em] text-ink-strong">
              Featured International Awards
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[16px] font-medium text-ink-strong">
              Co-planned with ACCK
              <span className="text-brand-blue">
                <Asterisk size={12} />
              </span>
            </span>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {AWARDS.map((award) => (
              <AwardCard key={award.title.join(" ")} award={award} />
            ))}
          </div>
        </div>

        {/* Annual calendar — 1/3 */}
        <div className="lg:col-span-1">
          <AnnualCalendar />
        </div>
      </div>
    </section>
  );
}
