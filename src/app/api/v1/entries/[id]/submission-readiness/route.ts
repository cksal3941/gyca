import { entryHandlers } from "@/server/entries/runtime";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return entryHandlers.readiness(request, id);
}
