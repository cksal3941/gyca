import { StatusBadge } from "@/components/ds";
import type { SaveStatus } from "@/lib/mock/submit-machine";
import type { Locale } from "@/lib/i18n";

/** Reflects the draft save state. A failed save is NEVER shown as saved. */
export default function SaveBadge({ status, locale }: { status: SaveStatus; locale: Locale }) {
  const ko = locale === "ko";
  if (status === "idle") return null;
  if (status === "saving")
    return <StatusBadge tone="info">{ko ? "임시저장 중…" : "Saving…"}</StatusBadge>;
  if (status === "saved")
    return <StatusBadge tone="success">{ko ? "저장 완료" : "Saved"}</StatusBadge>;
  return <StatusBadge tone="danger">{ko ? "저장 실패" : "Save failed"}</StatusBadge>;
}
