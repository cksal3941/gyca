import { resultAdminHandlers } from "@/server/entries/result-admin-runtime";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ competitionId: string; id: string }> }) {
  const params = await context.params; return resultAdminHandlers.updateFinalParticipation(request, params.competitionId, params.id);
}
