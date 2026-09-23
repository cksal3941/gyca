import { uploadHandlers } from "@/server/uploads/runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { readonly params: Promise<{ readonly id: string; readonly assetId: string }> }) {
  const { id, assetId } = await context.params;
  return uploadHandlers.complete(request, id, assetId);
}
