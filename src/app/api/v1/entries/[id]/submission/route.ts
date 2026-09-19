import { submissionRecord } from "@/server/entries/submission-record-runtime";

export async function GET(request: Request, context: { readonly params: Promise<{ id: string }> }) {
  return submissionRecord(request, (await context.params).id);
}
