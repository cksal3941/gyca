import { WHY, pick, type Locale } from "@/lib/content/leipzig-home";
import {
  Users,
  Award,
  Globe,
  Trophy,
  Calendar,
  ArrowUpRight,
} from "@/components/landing/icons";

const ICONS = [Users, Award, Globe, Trophy, Calendar, ArrowUpRight];

/** Section 2 · Why Participate — six benefits only, no repeated explanation. */
export default function WhyParticipate({ locale = "en" }: { locale?: Locale }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-page px-6 py-20">
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold uppercase tracking-[0.02em] text-ink-strong">
          {pick(WHY.title, locale)}
        </h2>

        <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {WHY.items.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div
                key={item.en}
                className="flex items-center gap-4 bg-white px-6 py-8"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas text-brand-blue">
                  <Icon size={20} />
                </span>
                <p className="text-[18px] font-semibold text-ink-strong">
                  {pick(item, locale)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
