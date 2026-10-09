import { editorialAdminHandlers } from "@/server/content/editorial-runtime";
export async function POST(request: Request, context: { readonly params: Promise<{ contentId: string }> }) {
  return editorialAdminHandlers.archive(request, (await context.params).contentId);
}
