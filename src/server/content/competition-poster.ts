import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AdminCompetitionPosterSchema, POSTER_CONTENT_TYPES, POSTER_MAX_BYTES, competitionPosterUrl } from '../../contracts/competition-poster.ts';
import type { EntryDatabase, SqlConnection } from '../entries/database.ts';
import { EntryFault } from '../entries/errors.ts';
import { authorizeArchiveEditor } from './archive-reader.ts';

const infoRow = z.object({ content_type: z.enum(POSTER_CONTENT_TYPES), byte_size: z.number().int().positive(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), uploaded_at: z.coerce.date() });
const slugRow = z.object({ slug: z.string() });

// The declared content type must match the file's own signature; nothing else is accepted.
export function sniffPosterType(bytes: Uint8Array): (typeof POSTER_CONTENT_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

async function competitionSlug(db: SqlConnection, id: string, lock = false) {
  const raw = (await db.query(`SELECT slug FROM gyca_competitions WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
  if (raw === undefined) throw new EntryFault('NOT_FOUND', 404);
  return slugRow.parse(raw).slug;
}
async function current(db: SqlConnection, id: string) {
  const raw = (await db.query('SELECT content_type,byte_size,sha256,uploaded_at FROM gyca_competition_posters WHERE competition_id=$1', [id])).rows[0];
  return raw === undefined ? null : infoRow.parse(raw);
}
function project(id: string, slug: string, row: z.infer<typeof infoRow> | null) {
  return AdminCompetitionPosterSchema.parse({ competitionId: id,
    poster: row === null ? null : { contentType: row.content_type, byteSize: row.byte_size, sha256: row.sha256,
      uploadedAt: row.uploaded_at.toISOString(), url: competitionPosterUrl(slug, row.sha256) },
    allowedActions: row === null ? ['upload'] : ['upload', 'remove'] });
}

export function createPosterService(database: EntryDatabase, now: () => Date) {
  return {
    get(actor: string, id: string) { return database.transaction(async db => {
      await authorizeArchiveEditor(db, actor);
      return project(id, await competitionSlug(db, id), await current(db, id));
    }); },
    upload(actor: string, id: string, bytes: Uint8Array, declaredType: string) { return database.transaction(async db => {
      await authorizeArchiveEditor(db, actor);
      const slug = await competitionSlug(db, id, true);
      if (bytes.byteLength === 0 || bytes.byteLength > POSTER_MAX_BYTES) throw new EntryFault('FILE_TOO_LARGE', 413);
      const sniffed = sniffPosterType(bytes);
      if (sniffed === null || sniffed !== declaredType.split(';')[0].trim().toLowerCase()) throw new EntryFault('VALIDATION_FAILED', 422);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const at = now();
      await db.query(`INSERT INTO gyca_competition_posters(competition_id,content_type,bytes,byte_size,sha256,uploaded_by,uploaded_at)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (competition_id) DO UPDATE SET content_type=EXCLUDED.content_type,bytes=EXCLUDED.bytes,
        byte_size=EXCLUDED.byte_size,sha256=EXCLUDED.sha256,uploaded_by=EXCLUDED.uploaded_by,uploaded_at=EXCLUDED.uploaded_at`,
        [id, sniffed, Buffer.from(bytes), bytes.byteLength, sha256, actor, at]);
      return project(id, slug, await current(db, id));
    }); },
    remove(actor: string, id: string) { return database.transaction(async db => {
      await authorizeArchiveEditor(db, actor);
      const slug = await competitionSlug(db, id, true);
      await db.query('DELETE FROM gyca_competition_posters WHERE competition_id=$1', [id]);
      return project(id, slug, null);
    }); },
    // Public bytes: only for published competitions, and only at the current content address.
    async publicBySlug(slug: string, version: string) {
      const raw = (await database.query(`SELECT p.content_type,p.bytes,p.sha256 FROM gyca_competition_posters p
        JOIN gyca_competitions c ON c.id=p.competition_id WHERE c.slug=$1 AND c.published=true AND c.public_content IS NOT NULL`, [slug])).rows[0];
      if (raw === undefined) throw new EntryFault('NOT_FOUND', 404);
      const row = z.object({ content_type: z.enum(POSTER_CONTENT_TYPES), bytes: z.instanceof(Uint8Array), sha256: z.string() }).parse(raw);
      if (row.sha256.slice(0, 16) !== version) throw new EntryFault('NOT_FOUND', 404);
      return { contentType: row.content_type, bytes: row.bytes, sha256: row.sha256 };
    },
  };
}
