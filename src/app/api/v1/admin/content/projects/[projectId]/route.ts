import { archiveAdminHandlers } from '@/server/content/archives-runtime';
export async function GET(request: Request, context: { readonly params: Promise<{ projectId: string }> }) {
  return archiveAdminHandlers.getAdmin(request, (await context.params).projectId);
}
export async function PATCH(request: Request, context: { readonly params: Promise<{ projectId: string }> }) {
  return archiveAdminHandlers.update(request, (await context.params).projectId);
}
