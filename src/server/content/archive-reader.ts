import { z } from 'zod';
import { ARCHIVE_SECTION_KINDS, ARCHIVE_STATUSES, ArchiveAdminItemSchema, ArchiveAdminPageSchema,
  ArchiveContentSchema, ArchivePublicItemSchema, ArchivePublicPageSchema } from '../../contracts/project-archive.ts';
import type { ArchivePublicItem, ArchiveSectionKind, ArchiveStatus } from '../../contracts/project-archive.ts';
import type { EntryDatabase, SqlConnection } from '../entries/database.ts';
import { EntryFault } from '../entries/errors.ts';

export const ArchiveRowSchema = z.object({ id: z.uuid(), slug: z.string(), status: z.enum(ARCHIVE_STATUSES),
  revision: z.number().int().positive(), content: ArchiveContentSchema, created_at: z.coerce.date(),
  updated_at: z.coerce.date(), published_at: z.coerce.date().nullable() });
export async function authorizeArchiveEditor(db: SqlConnection, actor: string) {
  if (!(await db.query('SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE', [actor])).rows.length)
    throw new EntryFault('FORBIDDEN', 403);
}
export function archiveActions(status: ArchiveStatus) {
  switch (status) {
    case 'draft': return ['edit', 'publish', 'archive'] as const;
    case 'published': return ['edit', 'archive'] as const;
    case 'archived': return [] as const;
    default: { const impossible: never = status; return impossible; }
  }
}
export function archiveAdminItem(raw: unknown) {
  const row = ArchiveRowSchema.parse(raw);
  return ArchiveAdminItemSchema.parse({ id: row.id, slug: row.slug, status: row.status, revision: row.revision,
    content: row.content, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    publishedAt: row.published_at?.toISOString() ?? null, allowedActions: archiveActions(row.status) });
}
export function archivePublicItem(raw: unknown, section: ArchiveSectionKind | null): ArchivePublicItem {
  const row = ArchiveRowSchema.parse(raw);
  if (row.status !== 'published' || row.published_at === null) throw new EntryFault('NOT_FOUND', 404);
  const sections = row.content.sections
    .filter(s => section === null ? !(s.optional && s.status === 'pending') : s.kind === section && s.status === 'ready')
    .toSorted((a, b) => a.order - b.order).map(s => {
      switch (s.status) {
        case 'ready': return s;
        case 'pending': return { kind: s.kind, order: s.order, title: s.title, status: s.status,
          optional: s.optional, pendingNote: s.pendingNote };
        default: { const impossible: never = s.status; return impossible; }
      }
    });
  return ArchivePublicItemSchema.parse({ id: row.id, slug: row.slug, status: 'completed', projectType: row.content.projectType,
    completionYear: row.content.completionYear, hero: row.content.hero, sections, publishedAt: row.published_at.toISOString() });
}
const cursorSchema = z.strictObject({ v: z.literal(1), id: z.uuid(), section: z.enum(ARCHIVE_SECTION_KINDS).nullable() });
export function decodeArchiveCursor(value: string | null, section: ArchiveSectionKind | null) {
  if (value === null) return null;
  try {
    const cursor = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    if (cursor.section !== section) throw new EntryFault('VALIDATION_FAILED', 422);
    return cursor.id;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) throw new EntryFault('VALIDATION_FAILED', 422);
    throw error;
  }
}
export function createArchiveReader(database: EntryDatabase) {
  return {
    getAdmin(actor: string, id: string) { return database.transaction(async db => {
      await authorizeArchiveEditor(db, actor);
      const raw = (await db.query('SELECT * FROM gyca_project_archives WHERE id=$1', [id])).rows[0];
      if (raw === undefined) throw new EntryFault('NOT_FOUND', 404);
      return archiveAdminItem(raw);
    }); },
    listAdmin(actor: string, page: { readonly status: ArchiveStatus | null; readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async db => {
        await authorizeArchiveEditor(db, actor);
        const rows = (await db.query(`SELECT * FROM gyca_project_archives WHERE ($1::text IS NULL OR status=$1)
          AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3`, [page.status, page.cursor, page.limit + 1])).rows.map(archiveAdminItem);
        const items = rows.slice(0, page.limit);
        return ArchiveAdminPageSchema.parse({ items, nextCursor: rows.length > page.limit ? items.at(-1)?.id ?? null : null });
      });
    },
    async getPublic(slug: string) {
      const raw = (await database.query(`SELECT a.* FROM gyca_project_archives a
        JOIN gyca_archive_publications p ON p.archive_id=a.id AND p.revision=a.revision
        WHERE a.slug=$1 AND a.status='published'`, [slug])).rows[0];
      if (raw === undefined) throw new EntryFault('NOT_FOUND', 404);
      return archivePublicItem(raw, null);
    },
    async listPublic(page: { readonly section: ArchiveSectionKind | null; readonly cursor: string | null; readonly limit: number }) {
      const rows = (await database.query(`SELECT a.* FROM gyca_project_archives a
        JOIN gyca_archive_publications p ON p.archive_id=a.id AND p.revision=a.revision
        WHERE a.status='published' AND ($1::uuid IS NULL OR a.id>$1)
        AND ($2::text IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(a.content->'sections') s
          WHERE s->>'kind'=$2 AND s->>'status'='ready')) ORDER BY a.id LIMIT $3`,
      [page.cursor, page.section, page.limit + 1])).rows.map(row => archivePublicItem(row, page.section));
      const items = rows.slice(0, page.limit); const last = items.at(-1);
      return ArchivePublicPageSchema.parse({ items, nextCursor: rows.length > page.limit && last !== undefined
        ? Buffer.from(JSON.stringify({ v: 1, id: last.id, section: page.section })).toString('base64url') : null });
    },
  };
}
