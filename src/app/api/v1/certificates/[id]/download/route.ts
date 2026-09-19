import { certificateHandlers } from "@/server/certificates/runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { readonly params: Promise<{ id: string }> }) {
  return certificateHandlers.download(request, (await context.params).id);
}
