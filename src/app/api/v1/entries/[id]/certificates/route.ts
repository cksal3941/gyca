import { certificateHandlers } from "@/server/certificates/runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { readonly params: Promise<{ id: string }> }) {
  return certificateHandlers.listEntry(request, (await context.params).id);
}
