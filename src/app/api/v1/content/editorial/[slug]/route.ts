import { editorialPublicHandlers } from "@/server/content/editorial-runtime";
export async function GET(request: Request, context: { readonly params: Promise<{ slug: string }> }) {
  return editorialPublicHandlers.get(request, (await context.params).slug);
}
