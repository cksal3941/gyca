import { resultAdminHandlers } from "@/server/entries/result-admin-runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return resultAdminHandlers.publishRound(request, (await context.params).competitionId, "official_selection");
}
