import { resultAdminHandlers } from "@/server/entries/result-admin-runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ competitionId: string; round: string }> }) {
  const params = await context.params; return resultAdminHandlers.publishRound(request, params.competitionId, params.round);
}
