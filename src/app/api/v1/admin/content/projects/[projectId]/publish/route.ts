import { archiveAdminHandlers } from '@/server/content/archives-runtime';
export async function POST(request: Request, context: { readonly params: Promise<{ projectId: string }> }) {
  return archiveAdminHandlers.publish(request, (await context.params).projectId);
}
