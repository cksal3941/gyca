import { z } from "zod";
import { UploadRequestSchema, RemoveUploadSchema } from "../../contracts/uploads.ts";
import { createAuthenticatedRunner, parseRequest, jsonBody } from "../entries/http.ts";
import type { createUploadService } from "./service.ts";

interface Dependencies {
  readonly service: ReturnType<typeof createUploadService>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}
export function createUploadHandlers(deps: Dependencies) {
  const run = createAuthenticatedRunner(deps);
  const id = (value: string) => parseRequest(z.uuid(), value);
  return {
    list: (request: Request, entryId: string) => run(request, false, 200, async (owner) => ({
      items: await deps.service.list(owner, id(entryId)), nextCursor: null,
    })),
    create: (request: Request, entryId: string) => run(request, true, 201, async (owner) => {
      const key = parseRequest(z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), request.headers.get("idempotency-key"));
      const input = parseRequest(UploadRequestSchema, await jsonBody(request));
      return deps.service.create(owner, id(entryId), key, input);
    }),
    complete: (request: Request, entryId: string, assetId: string) => run(request, true, 200, async (owner) => {
      parseRequest(z.strictObject({}), await jsonBody(request));
      return deps.service.complete(owner, id(entryId), id(assetId));
    }),
    remove: (request: Request, entryId: string, assetId: string) => run(request, true, 200, async (owner) => {
      const input = parseRequest(RemoveUploadSchema, await jsonBody(request));
      return deps.service.remove(owner, id(entryId), id(assetId), input.revision);
    }),
  };
}
