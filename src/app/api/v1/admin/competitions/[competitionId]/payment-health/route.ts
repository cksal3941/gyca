import { paymentHealth } from "@/server/payments/health-runtime";

export async function GET(request: Request, context: { readonly params: Promise<{ competitionId: string }> }) {
  return paymentHealth(request, (await context.params).competitionId);
}
