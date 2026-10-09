import { partnerPublicHandlers } from "@/server/content/partners-runtime";
export async function GET(request: Request, context: { readonly params: Promise<{ slug: string }> }) {
  return partnerPublicHandlers.get(request, (await context.params).slug);
}
