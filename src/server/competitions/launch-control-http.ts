import { z } from "zod";
import { OpenApplicationsSchema, RecordLaunchVerificationSchema } from "../../contracts/launch-control.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createLaunchControl } from "./launch-control.ts";

export function createLaunchControlHandlers(deps: {
  readonly service: ReturnType<typeof createLaunchControl>; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const competition = (id: string) => parseRequest(z.string().min(1).max(128), id);
  return {
    recordVerification: (request: Request, competitionId: string) => run(request, true, 200, async actor =>
      deps.service.recordVerification(actor, competition(competitionId),
        parseRequest(RecordLaunchVerificationSchema, await jsonBody(request)))),
    open: (request: Request, competitionId: string) => run(request, true, 200, async actor =>
      deps.service.open(actor, competition(competitionId), parseRequest(OpenApplicationsSchema, await jsonBody(request)))),
  };
}
