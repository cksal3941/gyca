import { archiveAdminHandlers } from '@/server/content/archives-runtime';
export async function POST(request: Request, context: { readonly params: Promise<{ projectId: string }> }) {
  return archiveAdminHandlers.archive(request, (await context.params).projectId);
}
