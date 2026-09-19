"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Shared control styling. focus ring + invalid state are token-driven.
export const controlClass =
  "w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong placeholder:text-ink outline-none focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/40 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/30 disabled:opacity-50";

type ControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Accessible field wrapper: associates the label (htmlFor/id), links help and
 * error text via aria-describedby, and marks the control aria-invalid on error.
 * Uses a render prop so any control can be wired: `{(f) => <input {...f} />}`.
 */
export function Field({
  label,
  help,
  error,
  required,
  children,
  className,
}: {
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  children: (control: ControlProps) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[16px] font-semibold text-ink-strong">
        {label}
        {required && (
          <span className="text-danger" aria-hidden>
            {" *"}
          </span>
        )}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {help && !error && (
        <p id={helpId} className="mt-1.5 text-[16px] text-ink-strong">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[16px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, className)} {...props}>
      {children}
    </select>
  );
}
