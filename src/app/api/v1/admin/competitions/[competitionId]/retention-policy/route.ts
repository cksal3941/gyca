import { retentionPolicyHandlers } from "@/server/competitions/admin-runtime";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return retentionPolicyHandlers.get(request, (await context.params).competitionId);
}
export async function PUT(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return retentionPolicyHandlers.update(request, (await context.params).competitionId);
}
