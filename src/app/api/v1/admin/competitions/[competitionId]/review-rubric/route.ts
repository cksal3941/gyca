import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return judgingHandlers.getRubric(request, (await context.params).competitionId);
}
export async function PUT(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return judgingHandlers.updateRubric(request, (await context.params).competitionId);
}
