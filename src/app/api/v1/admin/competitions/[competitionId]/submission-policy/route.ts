import { submissionPolicyHandlers } from "@/server/competitions/submission-policy-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return submissionPolicyHandlers.get(request, (await context.params).competitionId);
}
export async function PUT(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return submissionPolicyHandlers.update(request, (await context.params).competitionId);
}
