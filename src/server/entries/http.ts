import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CreateEntryRequestSchema, EntryIdSchema, UpdateEntryRequestSchema } from "../../contracts/index.ts";
import type { EntryRepository } from "./repository.ts";
import { EntryFault } from "./errors.ts";
import { SubmitEntryRequestSchema } from "../../contracts/submissions.ts";

interface AuthenticatedDependencies {
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}
interface Dependencies extends AuthenticatedDependencies { readonly repository: EntryRepository }

export function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new EntryFault("VALIDATION_FAILED", 422,
    result.error.issues.map((issue) => ({ path: issue.path.join("."), code: "INVALID_FORMAT" })));
  return result.data;
}

export async function jsonBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new EntryFault("VALIDATION_FAILED", 415);
  const reader = request.body?.getReader();
  if (reader === undefined) throw new EntryFault("VALIDATION_FAILED", 422);
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 131072) { await reader.cancel(); throw new EntryFault("VALIDATION_FAILED", 413); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof SyntaxError) throw new EntryFault("VALIDATION_FAILED", 422);
    throw error;
  } finally { reader.releaseLock(); }
}

export function createAuthenticatedRunner(deps: AuthenticatedDependencies) {
  return async (request: Request, mutate: boolean, status: number, action: (owner: string) => Promise<unknown>): Promise<Response> => {
    const requestId = randomUUID();
    const meta = () => ({ requestId, serverTime: deps.now().toISOString() });
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    try {
      if (mutate) {
        if (deps.origin === undefined) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        if (request.headers.get("origin") !== new URL(deps.origin).origin) throw new EntryFault("FORBIDDEN", 403);
      }
      const owner = await deps.getUserId(request);
      if (!owner) throw new EntryFault("UNAUTHENTICATED", 401);
      const data = await action(owner);
      return Response.json({ data, meta: meta() }, { status, headers });
    } catch (error) {
      if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code, retryable: false, fieldErrors: error.fieldErrors }, meta: meta() }, { status: error.status, headers });
      // Boundary logging intentionally excludes request bodies, identifiers and database errors.
      console.error("Entry request failed", { requestId });
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Request could not be completed", retryable: false, fieldErrors: [] }, meta: meta() }, { status: 500, headers });
    }
  };
}

export function createEntryHandlers(deps: Dependencies) {
  const run = createAuthenticatedRunner(deps);
  const id = (value: string) => EntryIdSchema.parse(parseRequest(z.uuid(), value));
  return {
    readiness: (request: Request, entryId: string) => run(request, false, 200, (owner) => {
      const locale = parseRequest(z.enum(["en", "ko"]), new URL(request.url).searchParams.get("locale") ?? "en");
      return deps.repository.readiness(owner, id(entryId), locale);
    }),
    submit: (request: Request, entryId: string) => run(request, true, 200, async (owner) => {
      const parsedId = id(entryId);
      const key = parseRequest(z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), request.headers.get("idempotency-key"));
      const input = parseRequest(SubmitEntryRequestSchema, await jsonBody(request));
      return deps.repository.submit(owner, parsedId, key, input);
    }),
    create: (request: Request) => run(request, true, 201, async (owner) => {
      const key = parseRequest(z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), request.headers.get("idempotency-key"));
      const input = parseRequest(CreateEntryRequestSchema, await jsonBody(request));
      return deps.repository.create(owner, input.competitionId, key);
    }),
    get: (request: Request, entryId: string) => run(request, false, 200, (owner) => deps.repository.get(owner, id(entryId))),
    list: (request: Request) => run(request, false, 200, (owner) => {
      const params = new URL(request.url).searchParams;
      const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
      const cursor = parseRequest(z.uuid().nullable(), params.get("cursor"));
      return deps.repository.list(owner, cursor, limit);
    }),
    update: (request: Request, entryId: string) => run(request, true, 200, async (owner) => {
      const parsedId = id(entryId);
      const input = parseRequest(UpdateEntryRequestSchema, await jsonBody(request));
      return deps.repository.update(owner, parsedId, input);
    }),
  };
}
