import { z } from "zod";
import { RequestRefundSchema } from "../../contracts/refunds.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createPaymentRefunds } from "./refunds.ts";

interface Dependencies {
  readonly service: ReturnType<typeof createPaymentRefunds>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}
export function createRefundHandlers(deps: Dependencies) {
  const run = createAuthenticatedRunner(deps);
  const target = (input: { readonly competitionId: string; readonly orderId: string }) => ({
    competitionId: parseRequest(z.string().min(1).max(200), input.competitionId),
    orderId: parseRequest(z.uuid(), input.orderId),
  });
  return {
    overview: (request: Request, input: { readonly competitionId: string; readonly orderId: string }) =>
      run(request, false, 200, actor => {
        const parsed = target(input);
        return deps.service.overview({ actor, competitionId: parsed.competitionId }, parsed.orderId);
      }),
    request: (request: Request, input: { readonly competitionId: string; readonly orderId: string }) =>
      run(request, true, 200, async actor => {
        const parsed = target(input);
        const body = parseRequest(RequestRefundSchema, await jsonBody(request));
        return deps.service.request({ actor, competitionId: parsed.competitionId }, parsed.orderId, body);
      }),
  };
}
