import { z } from "zod";
import { CompetitionEditSchema } from "../../contracts/competition-admin.ts";
import type { CompetitionEdit, UpdateCompetition } from "../../contracts/competition-admin.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ id: z.string(), revision: z.number().int(), slug: z.string(), public_content: z.unknown(),
  opens_at: z.date().nullable(), closes_at: z.date().nullable(), payment_closes_at: z.date().nullable(), published: z.boolean(),
  draft_enabled: z.boolean(), payment_enabled: z.boolean() });
async function authorize(db: SqlConnection, actor: string) {
  if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
    throw new EntryFault("FORBIDDEN", 403);
}
function project(raw: unknown) {
  const row = rowSchema.parse(raw);
  return { id: row.id, revision: row.revision, draftEnabled: row.draft_enabled, paymentEnabled: row.payment_enabled,
    input: CompetitionEditSchema.parse({ slug: row.slug, content: row.public_content, published: row.published,
      opensAt: row.opens_at?.toISOString() ?? null, closesAt: row.closes_at?.toISOString() ?? null,
      paymentClosesAt: row.payment_closes_at?.toISOString() ?? null }) };
}
export function createCompetitionAdmin(database: EntryDatabase, now: () => Date) {
  return {
    list(actor: string, page: { readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async db => {
        await authorize(db, actor);
        const rows = (await db.query(`SELECT id,revision,slug,published,draft_enabled,payment_enabled FROM gyca_competitions
          WHERE ($1::text IS NULL OR id>$1) ORDER BY id LIMIT $2`, [page.cursor, page.limit + 1])).rows.map(row =>
          z.object({ id: z.string(), revision: z.number().int(), slug: z.string(), published: z.boolean(), draft_enabled: z.boolean(), payment_enabled: z.boolean() }).parse(row));
        return { items: rows.slice(0, page.limit), nextCursor: rows.length > page.limit ? rows.at(page.limit - 1)?.id ?? null : null };
      });
    },
    get(actor: string, id: string) {
      return database.transaction(async db => {
        await authorize(db, actor);
        const row = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1", [id])).rows[0];
        if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
        return project(row);
      });
    },
    create(actor: string, request: { readonly id: string; readonly input: CompetitionEdit }) {
      return database.transaction(async db => {
        await authorize(db, actor);
        const { id, input } = request;
        const result = await db.query(`INSERT INTO gyca_competitions(id,slug,public_content,opens_at,closes_at,payment_closes_at,published)
          VALUES($1,$2,$3::jsonb,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`,
          [id, input.slug, JSON.stringify(input.content), input.opensAt, input.closesAt, input.paymentClosesAt, input.published]);
        const row = result.rows[0];
        if (row === undefined) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        await db.query("INSERT INTO gyca_competition_changes VALUES($1,1,$2,$3::jsonb,$4)", [id, actor, JSON.stringify(input), now()]);
        return project(row);
      });
    },
    update(actor: string, id: string, request: UpdateCompetition) {
      return database.transaction(async db => {
        await authorize(db, actor);
        const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
        const row = rowSchema.parse(raw);
        if (row.revision !== request.revision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.draft_enabled || row.payment_enabled || (await db.query("SELECT id FROM gyca_entries WHERE competition_id=$1 LIMIT 1", [id])).rows.length > 0)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const input = request.input;
        if (input.slug !== row.slug) throw new EntryFault("VALIDATION_FAILED", 422);
        const result = await db.query(`UPDATE gyca_competitions SET public_content=$2::jsonb,opens_at=$3,closes_at=$4,
          payment_closes_at=$5,published=$6,revision=revision+1 WHERE id=$1 RETURNING *`,
          [id, JSON.stringify(input.content), input.opensAt, input.closesAt, input.paymentClosesAt, input.published]);
        await db.query("INSERT INTO gyca_competition_changes VALUES($1,$2,$3,$4::jsonb,$5)", [id, row.revision + 1, actor, JSON.stringify(input), now()]);
        return project(result.rows[0]);
      });
    },
  };
}
