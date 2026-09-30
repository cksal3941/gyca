import { launchReadinessHandler } from "@/server/competitions/launch-runtime";
export async function GET(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return launchReadinessHandler(request, (await context.params).competitionId);
}
