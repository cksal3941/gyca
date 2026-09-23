import { z } from 'zod';
import { ARCHIVE_STATUSES, ArchiveSlugSchema, CreateArchiveSchema, UpdateArchiveSchema,
  PublishArchiveSchema, ArchiveTransitionSchema } from '../../contracts/project-archive.ts';
import type { ArchiveSectionKind } from '../../contracts/project-archive.ts';
import { createAuthenticatedRunner, jsonBody, parseRequest } from '../entries/http.ts';
import { decodeArchiveCursor } from './archive-reader.ts';
import type { createArchiveService } from './archives.ts';
import { contentQuery, createPublicContentRunner } from './public-http.ts';
export function createArchiveHandlers(deps: { readonly service: ReturnType<typeof createArchiveService>;
  readonly now: () => Date; readonly origin: string | undefined; readonly getUserId: (request: Request) => Promise<string | null> }) {
  const run = createAuthenticatedRunner(deps);
  return {
    listAdmin: (request: Request) => run(request, false, 200, actor => {
      const p = contentQuery(request, ['status', 'cursor', 'limit']);
      return deps.service.listAdmin(actor, { status: parseRequest(z.enum(ARCHIVE_STATUSES).nullable(), p.get('status')),
        cursor: parseRequest(z.uuid().nullable(), p.get('cursor')),
        limit: parseRequest(z.coerce.number().int().min(1).max(20), p.get('limit') ?? 10) });
    }),
    getAdmin: (request: Request, id: string) => run(request, false, 200, actor => deps.service.getAdmin(actor, parseRequest(z.uuid(), id))),
    create: (request: Request) => run(request, true, 201, async actor =>
      deps.service.create(actor, parseRequest(CreateArchiveSchema, await jsonBody(request)))),
    update: (request: Request, id: string) => run(request, true, 200, async actor =>
      deps.service.update(actor, parseRequest(z.uuid(), id), parseRequest(UpdateArchiveSchema, await jsonBody(request)))),
    publish: (request: Request, id: string) => run(request, true, 200, async actor =>
      deps.service.publish(actor, parseRequest(z.uuid(), id), parseRequest(PublishArchiveSchema, await jsonBody(request)))),
    archive: (request: Request, id: string) => run(request, true, 200, async actor =>
      deps.service.archive(actor, parseRequest(z.uuid(), id), parseRequest(ArchiveTransitionSchema, await jsonBody(request)))),
  };
}
export function createArchivePublicHandlers(service: ReturnType<typeof createArchiveService>, now: () => Date) {
  const run = createPublicContentRunner(now);
  return {
    get: (_request: Request, slug: string) => run(() => service.getPublic(parseRequest(ArchiveSlugSchema, slug))),
    list: (request: Request, section: ArchiveSectionKind | null = null) => run(() => {
      const p = contentQuery(request, ['cursor', 'limit']);
      return service.listPublic({ section, cursor: decodeArchiveCursor(parseRequest(z.string().max(1024).nullable(), p.get('cursor')), section),
        limit: parseRequest(z.coerce.number().int().min(1).max(20), p.get('limit') ?? 10) });
    }),
  };
}
