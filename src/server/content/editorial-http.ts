import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CreateEditorialSchema, EDITORIAL_CATEGORIES, EDITORIAL_STATUSES, TransitionEditorialSchema,
  UpdateEditorialSchema } from "../../contracts/editorial-content.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { decodeEditorialPublicCursor } from "./editorial.ts";
import type { createEditorialService } from "./editorial.ts";

export function createEditorialHandlers(deps: { readonly service: ReturnType<typeof createEditorialService>;
  readonly getUserId: (request: Request) => Promise<string | null>; readonly origin: string | undefined; readonly now: () => Date }) {
  const run = createAuthenticatedRunner(deps); const id = (value: string) => parseRequest(z.uuid(), value);
  const strictQuery = (request: Request, allowed: readonly string[]) => {
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new EntryFault("VALIDATION_FAILED", 422);
    return params;
  };
  return {
    listAdmin: (request: Request) => run(request, false, 200, actor => { const p = strictQuery(request, ["category", "status", "cursor", "limit"]);
      return deps.service.listAdmin(actor, { category: parseRequest(z.enum(EDITORIAL_CATEGORIES).nullable(), p.get("category")),
        status: parseRequest(z.enum(EDITORIAL_STATUSES).nullable(), p.get("status")), cursor: parseRequest(z.uuid().nullable(), p.get("cursor")),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), p.get("limit") ?? 20) }); }),
    getAdmin: (request: Request, contentId: string) => run(request, false, 200, actor => deps.service.getAdmin(actor, id(contentId))),
    create: (request: Request) => run(request, true, 201, async actor =>
      deps.service.create(actor, parseRequest(CreateEditorialSchema, await jsonBody(request)))),
    update: (request: Request, contentId: string) => run(request, true, 200, async actor =>
      deps.service.update(actor, id(contentId), parseRequest(UpdateEditorialSchema, await jsonBody(request)))),
    publish: (request: Request, contentId: string) => run(request, true, 200, async actor =>
      deps.service.publish(actor, id(contentId), parseRequest(TransitionEditorialSchema, await jsonBody(request)))),
    archive: (request: Request, contentId: string) => run(request, true, 200, async actor =>
      deps.service.archive(actor, id(contentId), parseRequest(TransitionEditorialSchema, await jsonBody(request)))),
  };
}

export function createEditorialPublicHandlers(service: ReturnType<typeof createEditorialService>, now: () => Date) {
  async function run(action: () => Promise<unknown>) {
    const meta = { requestId: randomUUID(), serverTime: now().toISOString() };
    const headers = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "X-Content-Type-Options": "nosniff" };
    try { return Response.json({ data: await action(), meta }, { headers }); }
    catch (error) { if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code,
      retryable: false, fieldErrors: error.fieldErrors }, meta }, { status: error.status, headers: { ...headers, "Cache-Control": "no-store" } });
      console.error("Editorial content request failed", { requestId: meta.requestId });
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Content could not be loaded", retryable: false, fieldErrors: [] }, meta },
        { status: 500, headers: { ...headers, "Cache-Control": "no-store" } }); }
  }
  const slug = (value: string) => parseRequest(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128), value);
  return {
    list: (request: Request) => run(async () => { const params = new URL(request.url).searchParams;
      for (const key of params.keys()) if (!(["category", "cursor", "limit"].includes(key)) || params.getAll(key).length !== 1)
        throw new EntryFault("VALIDATION_FAILED", 422);
      const category = parseRequest(z.enum(EDITORIAL_CATEGORIES).nullable(), params.get("category"));
      const cursor = decodeEditorialPublicCursor(parseRequest(z.string().max(2048).nullable(), params.get("cursor")), category);
      return service.listPublic(category, cursor, parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20)); }),
    get: (_request: Request, value: string) => run(() => service.getPublic(slug(value))),
  };
}
