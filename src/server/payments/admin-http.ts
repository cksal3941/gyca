import { z } from "zod";
import { AcceptLatePaymentRequestSchema, RequeueRecoveryRequestSchema } from "../../contracts/payment-admin.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createPaymentAdmin } from "./admin.ts";

interface Dependencies {
  readonly service: ReturnType<typeof createPaymentAdmin>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}
export function createPaymentAdminHandlers(deps: Dependencies) {
  const run = createAuthenticatedRunner(deps);
  const competition = (id: string) => parseRequest(z.string().min(1).max(200), id);
  return {
    detail: (request: Request, target: { readonly competitionId: string; readonly orderId: string }) => run(request, false, 200, actor =>
      deps.service.detail({ actor, competitionId: competition(target.competitionId) }, parseRequest(z.uuid(), target.orderId))),
    history: (request: Request, target: { readonly competitionId: string; readonly orderId: string }) => run(request, false, 200, (actor) => {
      const params = new URL(request.url).searchParams;
      return deps.service.history({ actor, competitionId: competition(target.competitionId) }, {
        orderId: parseRequest(z.uuid(), target.orderId), cursor: parseRequest(z.uuid().nullable(), params.get("cursor")),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20),
      });
    }),
    list: (request: Request, competitionId: string) => run(request, false, 200, (actor) => {
      const params = new URL(request.url).searchParams;
      return deps.service.list({ actor, competitionId: competition(competitionId) }, {
        cursor: parseRequest(z.uuid().nullable(), params.get("cursor")),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20),
      });
    }),
    requeue: (request: Request, target: { readonly competitionId: string; readonly orderId: string }) => run(request, true, 200, async (actor) => {
      const scope = { actor, competitionId: competition(target.competitionId) };
      const orderId = parseRequest(z.uuid(), target.orderId);
      const input = parseRequest(RequeueRecoveryRequestSchema, await jsonBody(request));
      return deps.service.requeue(scope, orderId, input);
    }),
    acceptLatePayment: (request: Request, target: { readonly competitionId: string; readonly orderId: string }) =>
      run(request, true, 200, async (actor) => {
        const scope = { actor, competitionId: competition(target.competitionId) };
        const orderId = parseRequest(z.uuid(), target.orderId);
        const input = parseRequest(AcceptLatePaymentRequestSchema, await jsonBody(request));
        return deps.service.acceptLatePayment(scope, orderId, input);
      }),
  };
}
