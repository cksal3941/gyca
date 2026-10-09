import { submissionPolicyHistory } from "@/server/competitions/policy-history-runtime";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return submissionPolicyHistory(request, (await context.params).competitionId);
}
