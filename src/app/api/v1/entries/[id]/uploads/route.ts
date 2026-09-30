import { uploadHandlers } from "@/server/uploads/runtime";

export const runtime = "nodejs";
type Context = { readonly params: Promise<{ readonly id: string }> };
export async function GET(request: Request, context: Context) {
  return uploadHandlers.list(request, (await context.params).id);
}
export async function POST(request: Request, context: Context) {
  return uploadHandlers.create(request, (await context.params).id);
}
