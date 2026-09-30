import { z } from "zod";
import { CreateCompetitionSchema, UpdateCompetitionSchema } from "../../contracts/competition-admin.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import type { createCompetitionAdmin } from "./admin.ts";

export function createCompetitionAdminHandlers(deps: {
  readonly service: ReturnType<typeof createCompetitionAdmin>;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const idSchema = z.string().min(1).max(128);
  return {
    list: (request: Request) => run(request, false, 200, actor => {
      const params = new URL(request.url).searchParams;
      return deps.service.list(actor, { cursor: parseRequest(idSchema.nullable(), params.get("cursor")),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20) });
    }),
    get: (request: Request, id: string) => run(request, false, 200, actor => deps.service.get(actor, parseRequest(idSchema, id))),
    create: (request: Request) => run(request, true, 201, async actor =>
      deps.service.create(actor, parseRequest(CreateCompetitionSchema, await jsonBody(request)))),
    update: (request: Request, id: string) => run(request, true, 200, async actor =>
      deps.service.update(actor, parseRequest(idSchema, id), parseRequest(UpdateCompetitionSchema, await jsonBody(request)))),
  };
}
