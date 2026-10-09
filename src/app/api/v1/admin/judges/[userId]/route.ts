import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ userId: string }> }) {
  return judgingHandlers.updateJudge(request, (await context.params).userId);
}
