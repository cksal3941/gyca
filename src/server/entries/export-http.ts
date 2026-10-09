import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryExportRequestSchema } from "../../contracts/entry-export.ts";
import { jsonBody, parseRequest } from "./http.ts";
import { EntryFault } from "./errors.ts";
import type { createEntryExport } from "./export.ts";

export function createEntryExportHandler(deps: {
  readonly service: ReturnType<typeof createEntryExport>; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  return async (request: Request, competitionId: string): Promise<Response> => {
    const requestId = randomUUID();
    const common = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
    const meta = () => ({ requestId, serverTime: deps.now().toISOString() });
    try {
      if (deps.origin === undefined) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      if (request.headers.get("origin") !== new URL(deps.origin).origin) throw new EntryFault("FORBIDDEN", 403);
      const actor = await deps.getUserId(request);
      if (!actor) throw new EntryFault("UNAUTHENTICATED", 401);
      const id = parseRequest(z.string().min(1).max(128), competitionId);
      const input = parseRequest(EntryExportRequestSchema, await jsonBody(request));
      const result = await deps.service(actor, id, input);
      return new Response(new Uint8Array(result.bytes), { status: 200, headers: { ...common,
        "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="gyca-entries.csv"',
        "X-GYCA-Export-ID": result.exportId, "X-GYCA-Export-Rows": String(result.rowCount) } });
    } catch (error) {
      if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code,
        retryable: false, fieldErrors: error.fieldErrors }, meta: meta() }, { status: error.status, headers: common });
      console.error("Entry export failed", { requestId });
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Export could not be generated",
        retryable: false, fieldErrors: [] }, meta: meta() }, { status: 500, headers: common });
    }
  };
}
