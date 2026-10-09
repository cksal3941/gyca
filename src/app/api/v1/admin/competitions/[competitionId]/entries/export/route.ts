import { entryExportHandler } from "@/server/entries/export-runtime";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return entryExportHandler(request, (await context.params).competitionId);
}
