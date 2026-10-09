import { paymentPolicyHistory } from "@/server/competitions/policy-history-runtime";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return paymentPolicyHistory(request, (await context.params).competitionId);
}
