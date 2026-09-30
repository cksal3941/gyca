import { competitionHandlers } from "@/server/competitions/runtime";

export const runtime = "nodejs";
export async function GET(request: Request, context: { readonly params: Promise<{ readonly slug: string }> }) {
  return competitionHandlers.get(request, (await context.params).slug);
}
