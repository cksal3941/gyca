import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryIdSchema, OrderIdSchema } from "../../contracts/index.ts";
import { EmptyPaymentRequestSchema, ConfirmPaymentRequestSchema } from "../../contracts/payments.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";
import type { createPaymentService } from "./service.ts";
import { SelectPaymentRouteSchema } from "../../contracts/payment-options.ts";
import type { createRoutedOrders } from "./routed-orders.ts";

interface Dependencies {
  readonly service: ReturnType<typeof createPaymentService>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
  readonly createRoutedOrder?: ReturnType<typeof createRoutedOrders>;
}
export function createPaymentHandlers(deps: Dependencies) {
  const run = createAuthenticatedRunner(deps);
  const orderId = (id: string) => OrderIdSchema.parse(parseRequest(z.uuid(), id));
  return {
    checkout: (request: Request, id: string) => run(request, true, 200, async (owner) => {
      const parsedId = orderId(id);
      parseRequest(EmptyPaymentRequestSchema, await jsonBody(request));
      return deps.service.checkout(owner, parsedId);
    }),
    confirm: (request: Request, id: string) => run(request, true, 200, async (owner) => {
      const parsedId = orderId(id);
      const input = parseRequest(ConfirmPaymentRequestSchema, await jsonBody(request));
      return deps.service.confirm(owner, parsedId, input.paymentKey);
    }),
    create: (request: Request, id: string) => run(request, true, 201, async (owner) => {
      const entryId = EntryIdSchema.parse(parseRequest(z.uuid(), id));
      const key = parseRequest(z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), request.headers.get("idempotency-key"));
      if (deps.createRoutedOrder !== undefined) {
        const input = parseRequest(SelectPaymentRouteSchema, await jsonBody(request));
        return deps.createRoutedOrder(owner, { entryId, key }, input);
      }
      parseRequest(EmptyPaymentRequestSchema, await jsonBody(request));
      return deps.service.create(owner, entryId, key);
    }),
    get: (request: Request, id: string) => run(request, false, 200, (owner) => deps.service.get(owner, orderId(id))),
    list: (request: Request) => run(request, false, 200, (owner) => {
      const params = new URL(request.url).searchParams;
      return deps.service.listSummaries(owner, parseRequest(z.uuid().nullable(), params.get("cursor")),
        parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20));
    }),
    reconcile: (request: Request, id: string) => run(request, true, 200, async (owner) => {
      const parsedId = orderId(id);
      parseRequest(EmptyPaymentRequestSchema, await jsonBody(request));
      return deps.service.reconcile(owner, parsedId);
    }),
    webhook: async (request: Request): Promise<Response> => {
      const requestId = randomUUID();
      const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
      const meta = () => ({ requestId, serverTime: deps.now().toISOString() });
      try {
        const reader = request.body?.getReader();
        if (reader === undefined) throw new EntryFault("VALIDATION_FAILED", 422);
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 262144) { await reader.cancel(); throw new EntryFault("VALIDATION_FAILED", 413); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        const data = await deps.service.webhook(Buffer.concat(chunks), request.headers);
        return Response.json({ data, meta: meta() }, { headers });
      } catch (error) {
        if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code,
          retryable: error.status >= 500, fieldErrors: [] }, meta: meta() }, { status: error.status, headers });
        console.error("Payment webhook failed", { requestId });
        return Response.json({ error: { code: "INTERNAL_ERROR", message: "Payment event could not be processed",
          retryable: true, fieldErrors: [] }, meta: meta() }, { status: 500, headers });
      }
    },
  };
}
