import { paymentPolicyHandlers } from "@/server/competitions/payment-policy-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return paymentPolicyHandlers.get(request, (await context.params).competitionId);
}
export async function PUT(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return paymentPolicyHandlers.update(request, (await context.params).competitionId);
}
