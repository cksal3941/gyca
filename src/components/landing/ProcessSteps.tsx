import type { ComponentType } from "react";
import { Search, PenLine, Globe, Trophy, ArrowRight } from "./icons";

type Step = {
  no: string;
  numColor: string;
  Icon: ComponentType<{ size?: number }>;
  title: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    no: "01",
    numColor: "text-brand-blue",
    Icon: Search,
    title: "Discover",
    desc: "Explore international opportunities in one place.",
  },
  {
    no: "02",
    numColor: "text-brand-purple",
    Icon: PenLine,
    title: "Apply",
    desc: "Submit your entry through GYCA.",
  },
  {
    no: "03",
    numColor: "text-brand-teal",
    Icon: Globe,
    title: "Advance",
    desc: "Advance to the international stage.",
  },
  {
    no: "04",
    numColor: "text-brand-blue",
    Icon: Trophy,
    title: "Achieve",
    desc: "Awards, certificates, and portfolio archive.",
  },
];

/** Small dotted-grid decoration echoing the reference mockup. */
function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute right-8 top-1/2 hidden h-24 w-40 -translate-y-1/2 xl:block"
      style={{
        backgroundImage: "radial-gradient(currentColor 1.5px, transparent 1.5px)",
        backgroundSize: "14px 14px",
        color: "var(--color-brand-teal)",
        opacity: 0.35,
      }}
      aria-hidden
    />
  );
}

export default function ProcessSteps() {
  return (
    <section className="bg-white pb-24">
      <div className="mx-auto max-w-shell px-6">
        <div className="relative overflow-hidden rounded-3xl bg-surface px-8 py-12 lg:px-12">
          <DotGrid />
          <div className="grid gap-10 lg:grid-cols-[260px_1fr] lg:items-center">
            <h2 className="font-serif text-[30px] font-bold leading-[1.2] tracking-[-0.01em] text-ink-strong">
              From Discovery
              <br />
              to the Global Stage
            </h2>

            <div className="grid gap-x-4 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.no} className="relative">
                  {/* Connector arrow between steps (desktop) */}
                  {i < STEPS.length - 1 && (
                    <span className="absolute -right-3 top-1 hidden text-neutral-300 xl:block">
                      <ArrowRight size={18} />
                    </span>
                  )}
                  <span
                    className={`text-[30px] font-extrabold tracking-[-0.02em] ${step.numColor}`}
                  >
                    {step.no}
                  </span>
                  <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink-strong ring-1 ring-black/5">
                    <step.Icon size={20} />
                  </span>
                  <h3 className="mt-4 text-[16px] font-bold text-ink-strong">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-[1.6] text-neutral-500">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
