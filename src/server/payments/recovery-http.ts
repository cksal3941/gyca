import { timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryFault } from "../entries/errors.ts";
import { jsonBody, parseRequest } from "../entries/http.ts";

export function createRecoveryHandler(deps: {
  readonly token: string | undefined;
  readonly enabled: boolean;
  readonly worker: { readonly runOnce: () => Promise<{ readonly outcome: string }> };
}) {
  return async (request: Request): Promise<Response> => {
    const requestId = randomUUID();
    const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    try {
      if (!deps.enabled || deps.token === undefined || deps.token.length < 32) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const authorization = request.headers.get("authorization") ?? "";
      const digest = (value: string) => createHash("sha256").update(value).digest();
      if (!timingSafeEqual(digest(authorization), digest(`Bearer ${deps.token}`))) throw new EntryFault("UNAUTHENTICATED", 401);
      parseRequest(z.strictObject({}), await jsonBody(request));
      return Response.json({ data: await deps.worker.runOnce(), requestId }, { headers });
    } catch (error) {
      const fault = error instanceof EntryFault ? error : new EntryFault("INTERNAL_ERROR", 500);
      return Response.json({ error: { code: fault.code }, requestId }, { status: fault.status, headers });
    }
  };
}
