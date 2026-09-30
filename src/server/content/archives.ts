import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ArchiveAdminItemSchema } from '../../contracts/project-archive.ts';
import type { ArchiveContent, ArchiveStatus, CreateArchiveSchema, UpdateArchiveSchema,
  PublishArchiveSchema, ArchiveTransitionSchema } from '../../contracts/project-archive.ts';
import type { EntryDatabase, SqlConnection } from '../entries/database.ts';
import { EntryFault } from '../entries/errors.ts';
import { ArchiveRowSchema, archiveAdminItem, authorizeArchiveEditor, createArchiveReader } from './archive-reader.ts';

type Mutation = { readonly kind: 'edit'; readonly input: z.infer<typeof UpdateArchiveSchema> }
  | { readonly kind: 'publish'; readonly input: z.infer<typeof PublishArchiveSchema> }
  | { readonly kind: 'archive'; readonly input: z.infer<typeof ArchiveTransitionSchema> };
type Action = { readonly actor: string; readonly actionId: string; readonly hash: string };
async function replay(db: SqlConnection, action: Action) {
  await authorizeArchiveEditor(db, action.actor);
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [action.actor, action.actionId]);
  const raw = (await db.query('SELECT request_hash,response FROM gyca_archive_actions WHERE actor_id=$1 AND action_id=$2',
    [action.actor, action.actionId])).rows[0];
  if (raw === undefined) return null;
  const saved = z.object({ request_hash: z.string(), response: ArchiveAdminItemSchema }).parse(raw);
  if (saved.request_hash !== action.hash) throw new EntryFault('IDEMPOTENCY_CONFLICT', 409);
  return saved.response;
}
async function recordAction(db: SqlConnection, action: Action, result: z.infer<typeof ArchiveAdminItemSchema>) {
  await db.query('INSERT INTO gyca_archive_actions VALUES($1,$2,$3,$4::jsonb,$5)',
    [action.actor, action.actionId, action.hash, JSON.stringify(result), result.updatedAt]);
  return result;
}
const digest = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');

export function createArchiveService(database: EntryDatabase, now: () => Date) {
  async function mutate(actor: string, id: string, mutation: Mutation) {
    return database.transaction(async db => {
      const action = { actor, actionId: mutation.input.actionId, hash: digest({ id, ...mutation }) };
      const saved = await replay(db, action); if (saved !== null) return saved;
      const raw = (await db.query('SELECT * FROM gyca_project_archives WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (raw === undefined) throw new EntryFault('NOT_FOUND', 404);
      const row = ArchiveRowSchema.parse(raw);
      if (row.revision !== mutation.input.expectedRevision) throw new EntryFault('REVISION_CONFLICT', 409);
      if (row.status === 'archived') throw new EntryFault('ENTRY_LOCKED', 409);
      const revision = row.revision + 1; const at = now();
      const next: { readonly status: ArchiveStatus; readonly content: ArchiveContent; readonly reason: string } = (() => {
        switch (mutation.kind) {
          case 'edit': return { status: 'draft', content: mutation.input.content, reason: 'edited' };
          case 'publish':
            if (row.status !== 'draft') throw new EntryFault('ENTRY_LOCKED', 409);
            if (!row.content.sections.some(s => s.status === 'ready')) throw new EntryFault('VALIDATION_FAILED', 422);
            return { status: 'published', content: row.content, reason: 'published' };
          case 'archive': return { status: 'archived', content: row.content, reason: 'archived' };
          default: { const impossible: never = mutation; return impossible; }
        }
      })();
      await db.query('INSERT INTO gyca_archive_changes VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)',
        [id, revision, next.status, JSON.stringify(next.content), actor, next.reason, at]);
      if (mutation.kind === 'publish') await db.query('INSERT INTO gyca_archive_publications VALUES($1,$2,$3,$4)',
        [id, revision, mutation.input.evidence.sourceReference, mutation.input.evidence.rightsReference]);
      const updated = (await db.query(`UPDATE gyca_project_archives SET status=$2,revision=$3,content=$4::jsonb,updated_at=$5,
        published_at=CASE WHEN $2='published' THEN $5 ELSE published_at END WHERE id=$1 RETURNING *`,
      [id, next.status, revision, JSON.stringify(next.content), at])).rows[0];
      return recordAction(db, action, archiveAdminItem(updated));
    });
  }
  return {
    ...createArchiveReader(database),
    create(actor: string, input: z.infer<typeof CreateArchiveSchema>) {
      return database.transaction(async db => {
        const action = { actor, actionId: input.actionId, hash: digest({ kind: 'create', input }) };
        const saved = await replay(db, action); if (saved !== null) return saved;
        const id = randomUUID(); const at = now();
        const raw = (await db.query(`INSERT INTO gyca_project_archives VALUES($1,$2,'draft',1,$3::jsonb,$4,$5,$5,NULL)
          ON CONFLICT(slug) DO NOTHING RETURNING *`, [id, input.slug, JSON.stringify(input.content), actor, at])).rows[0];
        if (raw === undefined) throw new EntryFault('IDEMPOTENCY_CONFLICT', 409);
        await db.query("INSERT INTO gyca_archive_changes VALUES($1,1,'draft',$2::jsonb,$3,'created',$4)",
          [id, JSON.stringify(input.content), actor, at]);
        return recordAction(db, action, archiveAdminItem(raw));
      });
    },
    update: (actor: string, id: string, input: z.infer<typeof UpdateArchiveSchema>) => mutate(actor, id, { kind: 'edit', input }),
    publish: (actor: string, id: string, input: z.infer<typeof PublishArchiveSchema>) => mutate(actor, id, { kind: 'publish', input }),
    archive: (actor: string, id: string, input: z.infer<typeof ArchiveTransitionSchema>) => mutate(actor, id, { kind: 'archive', input }),
  };
}
