import { judgingHandlers } from "@/server/judging/runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return judgingHandlers.submit(request, (await context.params).id);
}
