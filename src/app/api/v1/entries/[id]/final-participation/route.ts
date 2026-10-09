import { resultAdminHandlers } from "@/server/entries/result-admin-runtime";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return resultAdminHandlers.respondFinalParticipation(request, (await context.params).id);
}
