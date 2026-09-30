import { partnerAdminHandlers } from "@/server/content/partners-runtime";
export async function GET(request: Request, context: { readonly params: Promise<{ partnerId: string }> }) {
  return partnerAdminHandlers.getAdmin(request, (await context.params).partnerId);
}
export async function PATCH(request: Request, context: { readonly params: Promise<{ partnerId: string }> }) {
  return partnerAdminHandlers.update(request, (await context.params).partnerId);
}
