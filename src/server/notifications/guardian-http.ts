import { z } from "zod";
import { GuardianRequestSchema, GuardianPreviewSchema, GuardianAcceptSchema } from "../../contracts/guardian-consent.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";
import type { createGuardianConsent } from "./guardian-consent.ts";

export function createGuardianHandlers(deps: {
  readonly service: ReturnType<typeof createGuardianConsent>; readonly enabled: boolean;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const link = createAuthenticatedRunner({ ...deps, getUserId: async () => "guardian-link" });
  const enabled = () => { if (!deps.enabled) throw new EntryFault("POLICY_NOT_CONFIGURED", 503); };
  return {
    request: (request: Request, id: string) => run(request, true, 201, async owner => {
      enabled(); const input = parseRequest(GuardianRequestSchema, await jsonBody(request));
      return deps.service.request(owner, { ...input, entryId: parseRequest(z.uuid(), id) });
    }),
    status: (request: Request, id: string) => run(request, false, 200, owner => {
      enabled(); return deps.service.status(owner, parseRequest(z.uuid(), id));
    }),
    preview: (request: Request) => link(request, true, 200, async () => {
      enabled(); return deps.service.preview(parseRequest(GuardianPreviewSchema, await jsonBody(request)).token);
    }),
    accept: (request: Request) => link(request, true, 200, async () => {
      enabled(); return deps.service.accept(parseRequest(GuardianAcceptSchema, await jsonBody(request)));
    }),
  };
}
