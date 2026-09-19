"use client";

import { StatusBadge } from "@/components/ds";
import { REQUIRED_CONSENTS, OPTIONAL_CONSENTS_DEMO } from "@/lib/content/submit-consent";
import type { Locale } from "@/lib/i18n";

// Consents. Required (3) are always shown and gate submission. Optional consents
// are DATA-DRIVEN: only rendered when `showOptional` provides items — otherwise
// nothing is drawn (no heading, no empty box). Optional items are demo-only and
// never sent to the real API.

function CheckRow({
  checked,
  onToggle,
  title,
  summary,
  required,
  badge,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  summary: string;
  required?: boolean;
  badge?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-field p-4 hover:border-brand-blue">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 accent-brand-blue"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-ink-strong">
            {title}
            {required && <span className="text-danger" aria-hidden>{" *"}</span>}
          </span>
          {badge && <StatusBadge tone="neutral">{badge}</StatusBadge>}
        </span>
        <span className="mt-1 block text-[15px] leading-[1.6] text-ink-strong">{summary}</span>
      </span>
    </label>
  );
}

export default function ConsentSection({
  locale,
  consents,
  onToggle,
  optional,
  onToggleOptional,
  showOptional,
}: {
  locale: Locale;
  consents: Record<string, boolean>;
  onToggle: (kind: string) => void;
  optional: Record<string, boolean>;
  onToggleOptional: (key: string) => void;
  /** Full-version demo only. When false, the optional area renders nothing. */
  showOptional: boolean;
}) {
  const ko = locale === "ko";
  return (
    <div className="space-y-3">
      {REQUIRED_CONSENTS.map((c) => (
        <CheckRow
          key={c.kind}
          checked={!!consents[c.kind]}
          onToggle={() => onToggle(c.kind)}
          title={c.title[locale]}
          summary={c.summary[locale]}
          required
        />
      ))}

      {/* Guardian verification is a SEPARATE procedure, not a consent checkbox. */}
      <p className="text-[15px] leading-[1.6] text-ink-strong">
        {ko
          ? "보호자 확인은 별도 절차로 진행되며, 서버가 요구할 경우 안내됩니다."
          : "Guardian verification is a separate step, shown when the server requires it."}
      </p>

      {/* Optional consents — data-driven; nothing drawn when empty. */}
      {showOptional && OPTIONAL_CONSENTS_DEMO.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-field bg-canvas p-4">
          <p className="mb-3 text-[15px] font-semibold text-ink-strong">
            {ko ? "선택 동의" : "Optional consents"}
            <span className="ml-2 text-[13px] font-normal text-ink-strong/70">
              {ko ? "· 미구현 시연(실 API 미전송)" : "· demo only (not sent to the API)"}
            </span>
          </p>
          <div className="space-y-3">
            {OPTIONAL_CONSENTS_DEMO.map((o) => (
              <CheckRow
                key={o.key}
                checked={!!optional[o.key]}
                onToggle={() => onToggleOptional(o.key)}
                title={o.title[locale]}
                summary={o.summary[locale]}
                badge={ko ? "선택" : "Optional"}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
