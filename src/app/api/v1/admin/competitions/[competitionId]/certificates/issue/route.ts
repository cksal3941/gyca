import { certificateHandlers } from "@/server/certificates/runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { readonly params: Promise<{ competitionId: string }> }) {
  return certificateHandlers.issue(request, (await context.params).competitionId);
}
