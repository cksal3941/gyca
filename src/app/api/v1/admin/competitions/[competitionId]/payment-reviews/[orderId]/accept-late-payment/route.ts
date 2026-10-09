import { paymentAdminHandlers } from "@/server/payments/admin-runtime";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string; orderId: string }> }) {
  return paymentAdminHandlers.acceptLatePayment(request, await context.params);
}
