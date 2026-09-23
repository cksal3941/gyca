import { launchControlHandlers } from "@/server/competitions/launch-runtime";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  return launchControlHandlers.open(request, (await context.params).competitionId);
}
