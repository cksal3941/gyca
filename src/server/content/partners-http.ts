import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CreatePartnerSchema, PARTNER_RELATIONSHIP_STATUSES, PARTNER_STATUSES, PARTNER_TYPES,
  PartnerRelationshipSchema, PartnerTransitionSchema, UpdatePartnerSchema } from "../../contracts/partner-content.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { decodePartnerCursor } from "./partners.ts";
import type { createPartnerService } from "./partners.ts";

export function createPartnerHandlers(deps: { readonly service: ReturnType<typeof createPartnerService>;
  readonly getUserId: (request: Request) => Promise<string | null>; readonly origin: string | undefined; readonly now: () => Date }) {
  const run = createAuthenticatedRunner(deps); const id = (value: string) => parseRequest(z.uuid(), value);
  const strictQuery = (request: Request, allowed: readonly string[]) => {
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1) throw new EntryFault("VALIDATION_FAILED", 422);
    return params;
  };
  return {
    listAdmin: (request: Request) => run(request, false, 200, actor => { const p = strictQuery(request, ["status", "relationshipStatus", "cursor", "limit"]);
      return deps.service.listAdmin(actor, { status: parseRequest(z.enum(PARTNER_STATUSES).nullable(), p.get("status")),
        relationshipStatus: parseRequest(z.enum(PARTNER_RELATIONSHIP_STATUSES).nullable(), p.get("relationshipStatus")),
        cursor: parseRequest(z.uuid().nullable(), p.get("cursor")),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), p.get("limit") ?? 20) }); }),
    getAdmin: (request: Request, partnerId: string) => run(request, false, 200, actor => deps.service.getAdmin(actor, id(partnerId))),
    create: (request: Request) => run(request, true, 201, async actor =>
      deps.service.create(actor, parseRequest(CreatePartnerSchema, await jsonBody(request)))),
    update: (request: Request, partnerId: string) => run(request, true, 200, async actor =>
      deps.service.update(actor, id(partnerId), parseRequest(UpdatePartnerSchema, await jsonBody(request)))),
    confirm: (request: Request, partnerId: string) => run(request, true, 200, async actor =>
      deps.service.confirm(actor, id(partnerId), parseRequest(PartnerRelationshipSchema, await jsonBody(request)))),
    revoke: (request: Request, partnerId: string) => run(request, true, 200, async actor =>
      deps.service.revoke(actor, id(partnerId), parseRequest(PartnerRelationshipSchema, await jsonBody(request)))),
    publish: (request: Request, partnerId: string) => run(request, true, 200, async actor =>
      deps.service.publish(actor, id(partnerId), parseRequest(PartnerTransitionSchema, await jsonBody(request)))),
    archive: (request: Request, partnerId: string) => run(request, true, 200, async actor =>
      deps.service.archive(actor, id(partnerId), parseRequest(PartnerTransitionSchema, await jsonBody(request)))),
  };
}

export function createPartnerPublicHandlers(service: ReturnType<typeof createPartnerService>, now: () => Date) {
  async function run(action: () => Promise<unknown>) {
    const meta = { requestId: randomUUID(), serverTime: now().toISOString() };
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    try { return Response.json({ data: await action(), meta }, { headers }); }
    catch (error) { if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code,
      retryable: false, fieldErrors: error.fieldErrors }, meta }, { status: error.status, headers });
      console.error("Partner content request failed", { requestId: meta.requestId });
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Partner content could not be loaded", retryable: false, fieldErrors: [] }, meta },
        { status: 500, headers }); }
  }
  const slug = (value: string) => parseRequest(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128), value);
  return {
    list: (request: Request) => run(async () => { const params = new URL(request.url).searchParams;
      for (const key of params.keys()) if (!( ["partnerType", "cursor", "limit"].includes(key)) || params.getAll(key).length !== 1)
        throw new EntryFault("VALIDATION_FAILED", 422);
      const partnerType = parseRequest(z.enum(PARTNER_TYPES).nullable(), params.get("partnerType"));
      const cursor = decodePartnerCursor(parseRequest(z.string().max(2048).nullable(), params.get("cursor")), partnerType);
      return service.listPublic(partnerType, cursor, parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20)); }),
    get: (_request: Request, value: string) => run(() => service.getPublic(slug(value))),
  };
}
