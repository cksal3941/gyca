import { competitionAdminHandlers } from "@/server/competitions/admin-runtime";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return competitionAdminHandlers.get(request, (await context.params).competitionId);
}
export async function PATCH(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return competitionAdminHandlers.update(request, (await context.params).competitionId);
}
