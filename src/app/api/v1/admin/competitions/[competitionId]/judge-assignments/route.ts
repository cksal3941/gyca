import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return judgingHandlers.listAdminAssignments(request, (await context.params).competitionId);
}
export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return judgingHandlers.assign(request, (await context.params).competitionId);
}
