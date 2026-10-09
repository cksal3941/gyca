import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ competitionId: string; assignmentId: string }> }) {
  const params = await context.params; return judgingHandlers.revokeAssignment(request, params.competitionId, params.assignmentId);
}
