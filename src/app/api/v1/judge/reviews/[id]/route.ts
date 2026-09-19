import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return judgingHandlers.context(request, (await context.params).id);
}
