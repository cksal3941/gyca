import { paymentHandlers } from "@/server/payments/runtime";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return paymentHandlers.get(request, (await context.params).id);
}
