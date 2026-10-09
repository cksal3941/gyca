import { receiptAdminHandler } from "@/server/notifications/receipt-admin-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return receiptAdminHandler(request, (await context.params).competitionId);
}
