import { z } from 'zod';
import { CompetitionIdSchema } from '../../contracts/index.ts';
import { POSTER_MAX_BYTES } from '../../contracts/competition-poster.ts';
import { createAuthenticatedRunner, parseRequest } from '../entries/http.ts';
import { EntryFault } from '../entries/errors.ts';
import type { createPosterService } from './competition-poster.ts';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128);
const versionSchema = z.string().regex(/^[0-9a-f]{16}$/);

async function imageBody(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > POSTER_MAX_BYTES) throw new EntryFault('FILE_TOO_LARGE', 413);
  const reader = request.body?.getReader();
  if (reader === undefined) throw new EntryFault('VALIDATION_FAILED', 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > POSTER_MAX_BYTES) { await reader.cancel(); throw new EntryFault('FILE_TOO_LARGE', 413); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function createPosterHandlers(deps: { readonly service: ReturnType<typeof createPosterService>; readonly now: () => Date;
  readonly origin: string | undefined; readonly getUserId: (request: Request) => Promise<string | null> }) {
  const run = createAuthenticatedRunner(deps);
  return {
    get: (request: Request, id: string) => run(request, false, 200, actor => deps.service.get(actor, parseRequest(CompetitionIdSchema, id))),
    upload: (request: Request, id: string) => run(request, true, 200, async actor => {
      const competitionId = parseRequest(CompetitionIdSchema, id);
      const contentType = request.headers.get('content-type') ?? '';
      return deps.service.upload(actor, competitionId, await imageBody(request), contentType);
    }),
    remove: (request: Request, id: string) => run(request, true, 200, actor => deps.service.remove(actor, parseRequest(CompetitionIdSchema, id))),
    // Public image bytes. Content-addressed, so caches may keep it indefinitely.
    publicImage: async (slug: string, version: string): Promise<Response> => {
      const security = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" };
      try {
        const poster = await deps.service.publicBySlug(parseRequest(slugSchema, slug), parseRequest(versionSchema, version));
        return new Response(new Uint8Array(poster.bytes), { status: 200, headers: { ...security, 'Content-Type': poster.contentType,
          'Content-Length': String(poster.bytes.byteLength), 'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${poster.sha256}"` } });
      } catch (error) {
        const status = error instanceof EntryFault ? error.status : 500;
        if (!(error instanceof EntryFault)) console.error('Poster request failed');
        return new Response(null, { status, headers: { ...security, 'Cache-Control': 'no-store' } });
      }
    },
  };
}
