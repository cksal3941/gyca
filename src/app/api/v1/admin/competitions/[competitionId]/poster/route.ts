import { posterHandlers } from '@/server/content/competition-poster-runtime';

export const runtime = 'nodejs';
type Context = { readonly params: Promise<{ competitionId: string }> };
export async function GET(request: Request, context: Context) {
  return posterHandlers.get(request, (await context.params).competitionId);
}
// Raw image body (image/jpeg, image/png or image/webp, at most 5 MiB); replaces any previous poster.
export async function PUT(request: Request, context: Context) {
  return posterHandlers.upload(request, (await context.params).competitionId);
}
export async function DELETE(request: Request, context: Context) {
  return posterHandlers.remove(request, (await context.params).competitionId);
}
