import { adminEntryDetailHandler } from "@/server/entries/admin-runtime";
export const runtime = "nodejs";
export async function GET(request: Request, context: { readonly params: Promise<{ competitionId: string; id: string }> }) {
  const { competitionId, id } = await context.params; return adminEntryDetailHandler(request, competitionId, id);
}
