import { z } from "zod";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import type { createPaymentOptions } from "./options.ts";

export function createPaymentOptionsHandler(deps: {
  readonly service: ReturnType<typeof createPaymentOptions>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, entryId: string) => run(request, false, 200, owner =>
    deps.service(owner, parseRequest(z.uuid(), entryId)));
}
