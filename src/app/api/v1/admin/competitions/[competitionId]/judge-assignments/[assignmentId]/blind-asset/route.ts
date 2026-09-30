import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string; assignmentId: string }> }) {
  const params = await context.params; return judgingHandlers.getBlindAsset(request, params.competitionId, params.assignmentId);
}
