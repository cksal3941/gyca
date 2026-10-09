import { adminEntriesHandler } from "@/server/entries/admin-runtime";

export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return adminEntriesHandler(request, (await context.params).competitionId);
}
