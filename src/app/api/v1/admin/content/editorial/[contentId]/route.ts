import { editorialAdminHandlers } from "@/server/content/editorial-runtime";
export async function GET(request: Request, context: { readonly params: Promise<{ contentId: string }> }) {
  return editorialAdminHandlers.getAdmin(request, (await context.params).contentId);
}
export async function PATCH(request: Request, context: { readonly params: Promise<{ contentId: string }> }) {
  return editorialAdminHandlers.update(request, (await context.params).contentId);
}
