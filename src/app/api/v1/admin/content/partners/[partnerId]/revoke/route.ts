import { partnerAdminHandlers } from "@/server/content/partners-runtime";
export async function POST(request: Request, context: { readonly params: Promise<{ partnerId: string }> }) {
  return partnerAdminHandlers.revoke(request, (await context.params).partnerId);
}
