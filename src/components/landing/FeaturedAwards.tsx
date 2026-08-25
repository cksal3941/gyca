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
  title: string[];
  tags: string;
  status: string;
  statusColor: string;
};

const AWARDS: Award[] = [
  {
    image: "/images/awards/klimt.jpg",
    title: ["International Klimt", "Youth Award"],
    tags: "Art · Youth",
    status: "Preliminary Round Open",
    statusColor: "bg-brand-teal",
  },
  {
    image: "/images/awards/bach.jpg",
    title: ["Bach Festival", "International Competition"],
    tags: "Music · Performance",
    status: "Applications Open",
    statusColor: "bg-brand-teal",
  },
  {
    image: "/images/awards/viyba.jpg",
    title: ["VIYBA Vienna International", "Youth Book Award"],
    tags: "Book · Illustration",
    status: "Pre-registration Open",
    statusColor: "bg-brand-blue",
  },
];

function AwardCard({ award }: { award: Award }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-[0_24px_50px_-28px_rgba(17,17,17,0.4)]">
      <div
        className="h-[150px] w-full bg-surface bg-cover bg-center"
        style={{ backgroundImage: `url(${award.image})` }}
        role="img"
        aria-label={award.title.join(" ")}
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-[18px] font-bold leading-snug text-ink-strong">
          {award.title.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h3>
        <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-blue">
          {award.tags}
        </p>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-neutral-500">
          <span className={`h-2 w-2 rounded-full ${award.statusColor}`} />
          {award.status}
        </p>
        <a
          href="#"
          className="mt-5 inline-flex items-center gap-1.5 border-t border-line pt-4 text-[14px] font-semibold text-ink-strong group-hover:text-brand-blue"
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
        <h2 className="text-[26px] font-extrabold tracking-[-0.01em] text-ink-strong">
          Annual Calendar
        </h2>
        <a
          href="#"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue"
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
            <span className="w-[62px] shrink-0 text-[12px] font-bold tracking-[0.01em] text-ink-strong">
              {row.months}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-ink-strong">
                {row.title}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">
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
            <h2 className="text-[26px] font-extrabold tracking-[-0.01em] text-ink-strong">
              Featured International Awards
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-400">
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
