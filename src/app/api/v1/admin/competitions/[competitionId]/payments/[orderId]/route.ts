import { paymentAdminHandlers } from "@/server/payments/admin-runtime";

export async function GET(request: Request, context: { readonly params: Promise<{ competitionId: string; orderId: string }> }) {
  return paymentAdminHandlers.detail(request, await context.params);
}
