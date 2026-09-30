// Data-source mode for the frontend adapters.
//
//   "mock" — local fixtures (dev preview). Dev scenario buttons are visible.
//   "live" — real same-origin `/api/v1` calls with the Better Auth session.
//
// Switch with the build-time env var `NEXT_PUBLIC_API_MODE=live` (defaults to
// "mock"). A LIVE failure is shown as an error state — it is NEVER silently
// replaced with mock data. Adapters that are not yet wired return an explicit
// "NOT_CONNECTED" error in live mode rather than mock content.

export type ApiMode = "mock" | "live";

export const API_MODE: ApiMode = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";

export const isLive = API_MODE === "live";

/** Error state used when a feature has no live endpoint wired yet (live mode). */
export function notConnected(): {
  kind: "error";
  code: string;
  message: string;
  retryable: boolean;
} {
  return {
    kind: "error",
    code: "NOT_CONNECTED",
    message: "아직 서버에 연결되지 않은 기능입니다.",
    retryable: false,
  };
}
