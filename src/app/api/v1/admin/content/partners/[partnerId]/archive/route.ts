import { partnerAdminHandlers } from "@/server/content/partners-runtime";
export async function POST(request: Request, context: { readonly params: Promise<{ partnerId: string }> }) {
  return partnerAdminHandlers.archive(request, (await context.params).partnerId);
}
