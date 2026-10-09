import { presentationHandlers } from '@/server/content/competition-presentation-runtime';
export async function GET(request: Request, context: { readonly params: Promise<{ competitionId: string }> }) {
  return presentationHandlers.get(request, (await context.params).competitionId);
}
export async function PUT(request: Request, context: { readonly params: Promise<{ competitionId: string }> }) {
  return presentationHandlers.update(request, (await context.params).competitionId);
}
