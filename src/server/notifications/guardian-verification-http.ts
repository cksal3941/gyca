import { z } from "zod";
import { VerifyGuardianRequestSchema } from "../../contracts/guardian-admin.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createGuardianVerificationService } from "./guardian-verification.ts";

export function createGuardianVerificationHandler(deps: {
  readonly service: ReturnType<typeof createGuardianVerificationService>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string, entryId: string, requestId: string) => run(request, true, 200, async actor => {
    const scope = {
      competitionId: parseRequest(z.string().min(1).max(128), competitionId),
      entryId: parseRequest(z.uuid(), entryId),
      requestId: parseRequest(z.uuid(), requestId),
    };
    const input = parseRequest(VerifyGuardianRequestSchema, await jsonBody(request));
    return deps.service.verify(actor, scope, input);
  });
}
