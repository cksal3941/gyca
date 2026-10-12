"use client";

import { useState } from "react";

type Tab = { id: string; label: string; content: React.ReactNode };

/** Tabbed sections for a long contest detail page. Each panel is server-rendered
 *  and passed in as `content`; inactive panels stay mounted (hidden) so all copy
 *  remains in the DOM. The tab bar sticks under the site header while scrolling. */
export default function ContestTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div
        role="tablist"
        aria-label="공모전 안내 탭"
        className="sticky top-[68px] z-30 grid border-b border-line bg-white"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tb, i) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={`relative px-2 py-4 text-center text-[16px] transition-colors ${
              active === i ? "font-bold text-brand-blue" : "font-medium text-ink-strong hover:text-brand-blue"
            }`}
          >
            {tb.label}
            {active === i && (
              <span className="absolute inset-x-4 -bottom-px h-[3px] rounded-full bg-brand-blue" />
            )}
          </button>
        ))}
      </div>

      {tabs.map((tb, i) => (
        <div key={tb.id} role="tabpanel" hidden={active !== i} className="flex flex-col gap-16 pt-10">
          {tb.content}
        </div>
      ))}
    </div>
  );
}
