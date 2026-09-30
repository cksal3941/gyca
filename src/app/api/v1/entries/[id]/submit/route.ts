import { entryHandlers } from "@/server/entries/runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return entryHandlers.submit(request, id);
}
