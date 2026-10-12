import { posterHandlers } from '@/server/content/competition-poster-runtime';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: { readonly params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await context.params;
  return posterHandlers.publicImage(slug, version);
}
