import { guardianVerificationHandler } from "@/server/notifications/guardian-admin-runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{
  competitionId: string; id: string; requestId: string;
}> }) {
  const { competitionId, id, requestId } = await context.params;
  return guardianVerificationHandler(request, competitionId, id, requestId);
}
