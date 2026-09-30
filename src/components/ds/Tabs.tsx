"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tab = { value: string; label: string; content: ReactNode };

/**
 * Accessible tabs: proper tablist/tab/tabpanel roles, aria-selected, roving
 * tabindex, and Left/Right/Home/End keyboard navigation. Visible focus ring.
 */
export default function Tabs({
  tabs,
  defaultValue,
  className,
}: {
  tabs: Tab[];
  defaultValue?: string;
  className?: string;
}) {
  const baseId = useId();
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const last = tabs.length - 1;
    let next = -1;
    if (e.key === "ArrowRight") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next >= 0) {
      e.preventDefault();
      setActive(tabs[next].value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex flex-wrap gap-2 border-b border-line pb-4">
        {tabs.map((t, i) => {
          const selected = t.value === active;
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              role="tab"
              id={`${baseId}-tab-${t.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.value}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "rounded-full border px-4 py-2 text-[16px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2",
                selected
                  ? "border-black bg-black text-white"
                  : "border-line text-ink hover:border-black hover:text-ink-strong",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) => (
        <div
          key={t.value}
          role="tabpanel"
          id={`${baseId}-panel-${t.value}`}
          aria-labelledby={`${baseId}-tab-${t.value}`}
          hidden={t.value !== active}
          className="pt-6"
        >
          {t.value === active && t.content}
        </div>
      ))}
    </div>
  );
}
