import { entryHandlers } from "@/server/entries/runtime";

export const runtime = "nodejs";
type Context = { readonly params: Promise<{ readonly id: string }> };

export async function GET(request: Request, context: Context) {
  return entryHandlers.get(request, (await context.params).id);
}

export async function PATCH(request: Request, context: Context) {
  return entryHandlers.update(request, (await context.params).id);
}
