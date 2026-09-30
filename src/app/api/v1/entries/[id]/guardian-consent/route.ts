import { guardianHandlers } from "@/server/notifications/guardian-runtime";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return guardianHandlers.status(request, (await context.params).id);
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return guardianHandlers.request(request, (await context.params).id);
}
