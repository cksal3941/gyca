import { z } from 'zod';
import { CompetitionIdSchema } from '../../contracts/index.ts';
import { UpdateCompetitionPresentationSchema } from '../../contracts/competition-presentation.ts';
import { createAuthenticatedRunner, jsonBody, parseRequest } from '../entries/http.ts';
import { contentQuery, createPublicContentRunner } from './public-http.ts';
import type { createPresentationService } from './competition-presentation.ts';

export function createPresentationHandlers(deps: { readonly service: ReturnType<typeof createPresentationService>;
  readonly now: () => Date; readonly origin: string | undefined; readonly getUserId: (request: Request) => Promise<string | null> }) {
  const run = createAuthenticatedRunner(deps); const publicRun = createPublicContentRunner(deps.now);
  return {
    get: (request: Request, id: string) => run(request, false, 200, actor => deps.service.get(actor, parseRequest(CompetitionIdSchema, id))),
    update: (request: Request, id: string) => run(request, true, 200, async actor =>
      deps.service.update(actor, parseRequest(CompetitionIdSchema, id), parseRequest(UpdateCompetitionPresentationSchema, await jsonBody(request)))),
    list: (request: Request) => publicRun(() => {
      const p = contentQuery(request, ['cursor', 'limit']);
      return deps.service.list({ cursor: parseRequest(z.string().min(1).max(128).nullable(), p.get('cursor')),
        limit: parseRequest(z.coerce.number().int().min(1).max(50), p.get('limit') ?? 20) });
    }),
  };
}
