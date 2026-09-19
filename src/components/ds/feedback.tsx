import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CheckIcon, InfoIcon, WarningIcon, DangerIcon } from "./icons";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/* ---------------- Message / Alert ---------------- */

const MESSAGE_TONE: Record<
  Exclude<Tone, "neutral">,
  { wrap: string; icon: string; Icon: ComponentType<{ size?: number }>; role: "status" | "alert" }
> = {
  info: { wrap: "bg-info-soft", icon: "text-info", Icon: InfoIcon, role: "status" },
  success: { wrap: "bg-success-soft", icon: "text-success", Icon: CheckIcon, role: "status" },
  warning: { wrap: "bg-warning-soft", icon: "text-warning", Icon: WarningIcon, role: "alert" },
  danger: { wrap: "bg-danger-soft", icon: "text-danger", Icon: DangerIcon, role: "alert" },
};

/** Inline message. Meaning is carried by an icon + text, never color alone. */
export function Message({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Exclude<Tone, "neutral">;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = MESSAGE_TONE[tone];
  return (
    <div
      role={t.role}
      className={cn("flex items-start gap-3 rounded-lg p-4 text-ink-strong", t.wrap, className)}
    >
      <span className={cn("mt-0.5 shrink-0", t.icon)}>
        <t.Icon size={20} />
      </span>
      <div className="min-w-0 text-[16px] leading-[1.6]">
        {title && <p className="font-semibold">{title}</p>}
        {children && <p className={cn(title && "mt-1")}>{children}</p>}
      </div>
    </div>
  );
}

/* ---------------- Status badge ---------------- */

const BADGE_TONE: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: "border-line bg-white text-ink-strong", dot: "bg-neutral-400" },
  info: { wrap: "border-info/25 bg-info-soft text-info", dot: "bg-info" },
  success: { wrap: "border-success/25 bg-success-soft text-success", dot: "bg-success" },
  warning: { wrap: "border-warning/25 bg-warning-soft text-warning", dot: "bg-warning" },
  danger: { wrap: "border-danger/25 bg-danger-soft text-danger", dot: "bg-danger" },
};

/** Status pill. Always shows a label (+ dot); status is never color-only. */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = BADGE_TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold",
        t.wrap,
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
