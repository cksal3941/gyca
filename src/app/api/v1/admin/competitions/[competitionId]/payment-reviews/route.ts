import { paymentAdminHandlers } from "@/server/payments/admin-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return paymentAdminHandlers.list(request, (await context.params).competitionId);
}
