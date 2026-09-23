import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return judgingHandlers.save(request, (await context.params).id);
}
