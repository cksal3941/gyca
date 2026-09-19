import { CheckIcon } from "./icons";
import { cn } from "@/lib/utils";

type Step = { label: string };

/**
 * Horizontal step indicator. State is conveyed by shape + icon + label, not
 * color alone: done shows a check, current is a filled ring with aria-current,
 * upcoming shows its number.
 */
export default function Stepper({
  steps,
  current,
  className,
}: {
  steps: Step[];
  current: number; // 1-based index of the current step
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-y-3", className)}>
      {steps.map((s, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={s.label} className="flex items-center">
            <div className="flex items-center gap-2.5" aria-current={active ? "step" : undefined}>
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] font-bold",
                  active
                    ? "bg-black text-white"
                    : done
                      ? "bg-black/10 text-ink-strong"
                      : "border border-line bg-white text-ink-strong",
                )}
              >
                {done ? <CheckIcon size={16} /> : String(n).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[16px]",
                  active ? "font-semibold text-ink-strong" : "text-ink-strong",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn("mx-3 hidden h-px w-8 sm:block lg:w-12", done ? "bg-black" : "bg-line")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
