import { z } from "zod";
import { CancelPrivacyRequestSchema, CreatePrivacyRequestSchema, PRIVACY_REQUEST_STATES,
  ReviewPrivacyRequestSchema } from "../../contracts/privacy-requests.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createPrivacyRequestService } from "./service.ts";

export function createPrivacyRequestHandlers(deps: {
  readonly service: ReturnType<typeof createPrivacyRequestService>;
  readonly getUserId: (request: Request) => Promise<string | null>; readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const page = (request: Request, allowState: boolean) => {
    const params = new URL(request.url).searchParams; const allowed = allowState ? ["limit", "cursor", "state"] : ["limit", "cursor"];
    for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1)
      throw new EntryFault("VALIDATION_FAILED", 422);
    return { limit: parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20),
      cursor: parseRequest(z.uuid().nullable(), params.get("cursor")),
      state: allowState ? parseRequest(z.enum(PRIVACY_REQUEST_STATES).nullable(), params.get("state")) : null };
  };
  const id = (value: string) => parseRequest(z.uuid(), value);
  return {
    list: (request: Request) => run(request, false, 200, actor => {
      const input = page(request, false); return deps.service.list(actor, input.cursor, input.limit);
    }),
    create: (request: Request) => run(request, true, 201, async actor =>
      deps.service.create(actor, parseRequest(CreatePrivacyRequestSchema, await jsonBody(request)))),
    cancel: (request: Request, requestId: string) => run(request, true, 200, async actor =>
      deps.service.cancel(actor, id(requestId), parseRequest(CancelPrivacyRequestSchema, await jsonBody(request)))),
    listAdmin: (request: Request) => run(request, false, 200, actor => {
      const input = page(request, true); return deps.service.listAdmin(actor, input.state, input.cursor, input.limit);
    }),
    review: (request: Request, requestId: string) => run(request, true, 200, async actor =>
      deps.service.review(actor, id(requestId), parseRequest(ReviewPrivacyRequestSchema, await jsonBody(request)))),
  };
}
