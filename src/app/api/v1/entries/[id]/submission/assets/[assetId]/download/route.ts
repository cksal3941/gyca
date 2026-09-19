import { submissionDownload } from "@/server/uploads/submission-download-runtime";

export async function POST(request: Request, context: { readonly params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await context.params;
  return submissionDownload(request, id, assetId);
}
