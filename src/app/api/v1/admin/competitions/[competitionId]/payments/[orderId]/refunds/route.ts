import { refundHandlers } from "@/server/payments/refund-runtime";

type Context = { params: Promise<{ competitionId: string; orderId: string }> };
export async function GET(request: Request, context: Context) {
  return refundHandlers.overview(request, await context.params);
}
export async function POST(request: Request, context: Context) {
  return refundHandlers.request(request, await context.params);
}
