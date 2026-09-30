import { paymentAdminHandlers } from "@/server/payments/admin-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string; orderId: string }> }) {
  return paymentAdminHandlers.history(request, await context.params);
}
