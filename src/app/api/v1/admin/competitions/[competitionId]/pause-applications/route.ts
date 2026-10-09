import { pauseApplicationsHandler } from "@/server/competitions/pause-runtime";
export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return pauseApplicationsHandler(request, (await context.params).competitionId);
}
