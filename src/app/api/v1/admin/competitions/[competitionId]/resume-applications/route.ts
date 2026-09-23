import { resumeApplicationsHandler } from "@/server/competitions/pause-runtime";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return resumeApplicationsHandler(request, (await context.params).competitionId);
}
