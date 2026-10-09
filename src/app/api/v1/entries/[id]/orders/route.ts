import { paymentHandlers } from "@/server/payments/runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return paymentHandlers.create(request, (await context.params).id);
}
