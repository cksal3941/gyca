import { consentEvidence } from "@/server/entries/consent-evidence-runtime";

export async function GET(request: Request, context: { readonly params: Promise<{ competitionId: string; id: string }> }) {
  const { competitionId, id } = await context.params;
  return consentEvidence(request, competitionId, id);
}
