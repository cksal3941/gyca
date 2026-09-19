import { guardianAdminHandler } from "@/server/notifications/guardian-admin-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string; id: string }> }) {
  const { competitionId, id } = await context.params;
  return guardianAdminHandler(request, competitionId, id);
}
