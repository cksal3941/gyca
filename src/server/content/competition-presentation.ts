import { z } from 'zod';
import { CompetitionPresentationSchema, AdminCompetitionPresentationSchema, CompetitionCardsPageSchema } from '../../contracts/competition-presentation.ts';
import type { UpdateCompetitionPresentationSchema } from '../../contracts/competition-presentation.ts';
import type { EntryDatabase } from '../entries/database.ts';
import { EntryFault } from '../entries/errors.ts';
import { CompetitionRowSchema, projectCompetition } from '../competitions/policy.ts';
import { authorizeArchiveEditor } from './archive-reader.ts';

const empty = { summary: null, category: null, city: null, cover: null } as const;
const presentationRow = z.object({ revision: z.number().int().positive(), content: CompetitionPresentationSchema, updated_at: z.coerce.date() });
export function createPresentationService(database: EntryDatabase, now: () => Date) {
  return {
    get(actor: string, id: string) { return database.transaction(async db => {
      await authorizeArchiveEditor(db, actor);
      if (!(await db.query('SELECT id FROM gyca_competitions WHERE id=$1', [id])).rows.length) throw new EntryFault('NOT_FOUND', 404);
      const raw = (await db.query('SELECT * FROM gyca_competition_presentations WHERE competition_id=$1', [id])).rows[0];
      const row = raw === undefined ? null : presentationRow.parse(raw);
      return AdminCompetitionPresentationSchema.parse({ competitionId: id, revision: row?.revision ?? 0,
        content: row?.content ?? empty, updatedAt: row?.updated_at.toISOString() ?? null, allowedActions: ['edit'] });
    }); },
    update(actor: string, id: string, input: z.infer<typeof UpdateCompetitionPresentationSchema>) {
      return database.transaction(async db => {
        await authorizeArchiveEditor(db, actor);
        if (!(await db.query('SELECT id FROM gyca_competitions WHERE id=$1 FOR UPDATE', [id])).rows.length) throw new EntryFault('NOT_FOUND', 404);
        const raw = (await db.query('SELECT * FROM gyca_competition_presentations WHERE competition_id=$1', [id])).rows[0];
        const previous = raw === undefined ? null : presentationRow.parse(raw);
        if ((previous?.revision ?? 0) !== input.expectedRevision) throw new EntryFault('REVISION_CONFLICT', 409);
        const revision = input.expectedRevision + 1; const at = now();
        await db.query('INSERT INTO gyca_competition_presentation_changes VALUES($1,$2,$3::jsonb,$4,$5,$6)',
          [id, revision, JSON.stringify(input.content), actor, input.evidenceReference, at]);
        const values = [id, revision, JSON.stringify(input.content), at];
        if (previous === null) {
          await db.query('INSERT INTO gyca_competition_presentations VALUES($1,$2,$3::jsonb,$4)', values);
        } else {
          await db.query('UPDATE gyca_competition_presentations SET revision=$2,content=$3::jsonb,updated_at=$4 WHERE competition_id=$1', values);
        }
        return AdminCompetitionPresentationSchema.parse({ competitionId: id, revision, content: input.content,
          updatedAt: at.toISOString(), allowedActions: ['edit'] });
      });
    },
    async list(page: { readonly cursor: string | null; readonly limit: number }) {
      const rows = (await database.query(`SELECT c.*,p.content AS presentation FROM gyca_competitions c
        LEFT JOIN gyca_competition_presentations p ON p.competition_id=c.id
        WHERE c.published=true AND c.public_content IS NOT NULL AND ($1::text IS NULL OR c.id>$1) ORDER BY c.id LIMIT $2`,
      [page.cursor, page.limit + 1])).rows;
      const cards = rows.map(raw => {
        const row = CompetitionRowSchema.extend({ presentation: CompetitionPresentationSchema.nullable() }).parse(raw);
        const competition = projectCompetition(row, now());
        if (competition === null) throw new EntryFault('NOT_FOUND', 404);
        const content = row.presentation ?? empty;
        return { competition, presentation: { ...content,
          city: competition.exhibition?.approvalStatus === 'approved' ? content.city : null } };
      });
      const items = cards.slice(0, page.limit);
      return CompetitionCardsPageSchema.parse({ items, nextCursor: cards.length > page.limit ? items.at(-1)?.competition.id ?? null : null });
    },
  };
}
