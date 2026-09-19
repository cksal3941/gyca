import { resultAdminHandlers } from "@/server/entries/result-admin-runtime";

export const runtime = "nodejs";
type Context = { params: Promise<{ competitionId: string; id: string }> };
export async function GET(request: Request, context: Context) {
  const params = await context.params;
  return resultAdminHandlers.getReview(request, params.competitionId, params.id);
}
export async function PUT(request: Request, context: Context) {
  const params = await context.params;
  return resultAdminHandlers.updateReview(request, params.competitionId, params.id);
}
