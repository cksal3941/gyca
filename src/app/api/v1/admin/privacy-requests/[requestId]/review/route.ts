import { privacyRequestHandlers } from "@/server/privacy/runtime";

export async function POST(request: Request, context: { readonly params: Promise<{ requestId: string }> }) {
  return privacyRequestHandlers.review(request, (await context.params).requestId);
}
