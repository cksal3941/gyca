"use client";

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
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

type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

function readOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === "option") {
      const p = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
      out.push({ value: String(p.value ?? ""), label: p.children, disabled: p.disabled });
    }
  });
  return out;
}

/**
 * Select — a CUSTOM listbox (not the native <select>) so the open list is fully
 * styleable (black highlight, not the browser's OS blue). Keeps the native API:
 * pass `<option>` children + `value` + `onChange(e => e.target.value)` exactly as
 * before, so call sites need no change. Keyboard + a11y (roles, activedescendant,
 * arrow/enter/escape/home/end) and outside-click-to-close are handled here.
 */
export function Select({
  className,
  children,
  value,
  onChange,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: ComponentProps<"select">) {
  const options = readOptions(children);
  const current = String(value ?? "");
  const selectedIndex = options.findIndex((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex < 0 ? 0 : selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const uid = useId();

  // Open the list with the keyboard cursor on the currently-selected option.
  const openList = () => {
    setActive(selectedIndex < 0 ? 0 : selectedIndex);
    setOpen(true);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(uid)}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, uid]);

  const commit = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    setOpen(false);
    if (o.value !== current) {
      onChange?.({ target: { value: o.value } } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); commit(active); }
    else if (e.key === "Tab") { setOpen(false); }
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${uid}-list` : undefined}
        aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid}
        disabled={disabled ?? undefined}
        onClick={() => { if (disabled) return; if (open) setOpen(false); else openList(); }}
        onKeyDown={onKeyDown}
        className={cn(controlClass, "flex items-center justify-between gap-2 text-left")}
      >
        <span className="truncate">{selectedIndex >= 0 ? options[selectedIndex].label : ""}</span>
        <svg
          aria-hidden
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-ink-strong transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${uid}-list`}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-50 -mt-px max-h-64 w-full overflow-auto rounded-md border border-line bg-white py-1 shadow-lg"
        >
          {options.map((o, i) => {
            const isSelected = o.value === current;
            const isActive = i === active;
            return (
              <li
                key={`${o.value}-${i}`}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); commit(i); }}
                className={cn(
                  "cursor-pointer px-4 py-2 text-[16px]",
                  o.disabled && "cursor-not-allowed opacity-50",
                  isActive || isSelected ? "bg-black text-white" : "text-ink-strong",
                )}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
