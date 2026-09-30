import { withdrawDraft, withdrawDraftReadiness } from "@/server/entries/withdraw-draft-runtime";

export async function GET(request: Request, context: { readonly params: Promise<{ id: string }> }) {
  return withdrawDraftReadiness(request, (await context.params).id);
}

export async function POST(request: Request, context: { readonly params: Promise<{ id: string }> }) {
  return withdrawDraft(request, (await context.params).id);
}
