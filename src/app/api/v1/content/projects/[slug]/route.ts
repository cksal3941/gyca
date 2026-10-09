import { archivePublicHandlers } from '@/server/content/archives-runtime';
export async function GET(request: Request, context: { readonly params: Promise<{ slug: string }> }) {
  return archivePublicHandlers.get(request, (await context.params).slug);
}
