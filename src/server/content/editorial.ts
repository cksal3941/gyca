import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { EditorialAdminItemSchema, EditorialAdminPageSchema, EditorialBodySchema, EditorialPublicItemSchema,
  EditorialPublicPageSchema, EDITORIAL_CATEGORIES, EDITORIAL_STATUSES } from "../../contracts/editorial-content.ts";
import type { EditorialBody } from "../../contracts/editorial-content.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ id: z.uuid(), slug: z.string(), category: z.enum(EDITORIAL_CATEGORIES), status: z.enum(EDITORIAL_STATUSES),
  revision: z.number().int().positive(), content: z.unknown(), created_at: z.coerce.date(), updated_at: z.coerce.date(),
  published_at: z.coerce.date().nullable() });
const publicCursorSchema = z.object({ v: z.literal(1), category: z.enum(EDITORIAL_CATEGORIES).nullable(),
  publishedAt: z.iso.datetime(), id: z.uuid() });
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function actions(status: z.infer<typeof rowSchema>["status"]) {
  return status === "draft" ? ["edit", "publish", "archive"] as const
    : status === "published" ? ["edit", "archive"] as const : [] as const;
}
function adminItem(raw: unknown) {
  const row = rowSchema.parse(raw); return EditorialAdminItemSchema.parse({ id: row.id, slug: row.slug, category: row.category,
    status: row.status, revision: row.revision, content: row.content, createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null, allowedActions: actions(row.status) });
}
function publicItem(raw: unknown) {
  const row = rowSchema.parse(raw); if (row.status !== "published" || row.published_at === null) throw new EntryFault("NOT_FOUND", 404);
  return EditorialPublicItemSchema.parse({ id: row.id, slug: row.slug, category: row.category, content: row.content,
    publishedAt: row.published_at.toISOString() });
}
async function authorize(db: SqlConnection, actor: string) {
  if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
    throw new EntryFault("FORBIDDEN", 403);
}
async function replay(db: SqlConnection, actor: string, actionId: string, requestHash: string) {
  const raw = (await db.query("SELECT request_hash,response FROM gyca_editorial_content_actions WHERE actor_id=$1 AND action_id=$2", [actor, actionId])).rows[0];
  if (raw === undefined) return null; const row = z.object({ request_hash: z.string(), response: z.unknown() }).parse(raw);
  if (row.request_hash !== requestHash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409); return EditorialAdminItemSchema.parse(row.response);
}
async function saveAction(db: SqlConnection, actor: string, actionId: string, requestHash: string, response: unknown, at: Date) {
  await db.query("INSERT INTO gyca_editorial_content_actions(actor_id,action_id,request_hash,response,created_at) VALUES($1,$2,$3,$4::jsonb,$5)",
    [actor, actionId, requestHash, JSON.stringify(response), at]);
}
function encodePublicCursor(item: z.infer<typeof EditorialPublicItemSchema>, category: (typeof EDITORIAL_CATEGORIES)[number] | null) {
  return Buffer.from(JSON.stringify({ v: 1, category, publishedAt: item.publishedAt, id: item.id })).toString("base64url");
}
export function decodeEditorialPublicCursor(value: string | null, category: (typeof EDITORIAL_CATEGORIES)[number] | null) {
  if (value === null) return null;
  try { const parsed = publicCursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.category !== category) throw new Error("category mismatch"); return parsed;
  } catch { throw new EntryFault("VALIDATION_FAILED", 422); }
}

export function createEditorialService(database: EntryDatabase, now: () => Date) {
  async function transition(actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number },
    target: "published" | "archived") {
    return database.transaction(async db => {
      await authorize(db, actor); const requestHash = digest({ id, target, ...input });
      const saved = await replay(db, actor, input.actionId, requestHash); if (saved !== null) return saved;
      const raw = (await db.query("SELECT * FROM gyca_editorial_content WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
      if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      if ((target === "published" && row.status !== "draft") || (target === "archived" && row.status === "archived"))
        throw new EntryFault("ENTRY_LOCKED", 409);
      const at = now(); const revision = row.revision + 1; const reason = target === "published" ? "published" : "archived";
      await db.query(`INSERT INTO gyca_editorial_content_changes(content_id,revision,status,snapshot,actor_id,reason,created_at)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`, [id, revision, target, JSON.stringify(row.content), actor, reason, at]);
      const updated = (await db.query(`UPDATE gyca_editorial_content SET status=$2,revision=$3,updated_at=$4,
        published_at=CASE WHEN $2='published' THEN $4 ELSE published_at END WHERE id=$1 RETURNING *`, [id, target, revision, at])).rows[0];
      const result = adminItem(updated); await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
    });
  }
  return {
    create(actor: string, input: { readonly actionId: string; readonly slug: string; readonly category: (typeof EDITORIAL_CATEGORIES)[number]; readonly content: EditorialBody }) {
      return database.transaction(async db => {
        await authorize(db, actor); const requestHash = digest(input); const saved = await replay(db, actor, input.actionId, requestHash);
        if (saved !== null) return saved; const at = now(); const id = randomUUID();
        const inserted = (await db.query(`INSERT INTO gyca_editorial_content(id,slug,category,status,revision,content,created_by,created_at,updated_at)
          VALUES($1,$2,$3,'draft',1,$4::jsonb,$5,$6,$6) ON CONFLICT(slug) DO NOTHING RETURNING *`,
        [id, input.slug, input.category, JSON.stringify(input.content), actor, at])).rows[0];
        if (inserted === undefined) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        await db.query(`INSERT INTO gyca_editorial_content_changes(content_id,revision,status,snapshot,actor_id,reason,created_at)
          VALUES($1,1,'draft',$2::jsonb,$3,'created',$4)`, [id, JSON.stringify(input.content), actor, at]);
        const result = adminItem(inserted); await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
      });
    },
    update(actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number; readonly content: EditorialBody }) {
      return database.transaction(async db => {
        await authorize(db, actor); const requestHash = digest({ id, ...input }); const saved = await replay(db, actor, input.actionId, requestHash);
        if (saved !== null) return saved; const raw = (await db.query("SELECT * FROM gyca_editorial_content WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.status === "archived") throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now(); const revision = row.revision + 1; const content = EditorialBodySchema.parse(input.content);
        await db.query(`INSERT INTO gyca_editorial_content_changes(content_id,revision,status,snapshot,actor_id,reason,created_at)
          VALUES($1,$2,$3,$4::jsonb,$5,'edited',$6)`, [id, revision, row.status, JSON.stringify(content), actor, at]);
        const updated = (await db.query("UPDATE gyca_editorial_content SET content=$2::jsonb,revision=$3,updated_at=$4 WHERE id=$1 RETURNING *",
          [id, JSON.stringify(content), revision, at])).rows[0];
        const result = adminItem(updated); await saveAction(db, actor, input.actionId, requestHash, result, at); return result;
      });
    },
    publish: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number }) => transition(actor, id, input, "published"),
    archive: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number }) => transition(actor, id, input, "archived"),
    getAdmin(actor: string, id: string) { return database.transaction(async db => { await authorize(db, actor);
      const row = (await db.query("SELECT * FROM gyca_editorial_content WHERE id=$1", [id])).rows[0];
      if (row === undefined) throw new EntryFault("NOT_FOUND", 404); return adminItem(row); }); },
    listAdmin(actor: string, filter: { readonly category: string | null; readonly status: string | null; readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async db => { await authorize(db, actor);
        const rows = (await db.query(`SELECT * FROM gyca_editorial_content WHERE ($1::text IS NULL OR category=$1)
          AND ($2::text IS NULL OR status=$2) AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4`,
        [filter.category, filter.status, filter.cursor, filter.limit + 1])).rows.map(adminItem); const page = rows.slice(0, filter.limit);
        return EditorialAdminPageSchema.parse({ items: page, nextCursor: rows.length > filter.limit ? page.at(-1)?.id ?? null : null }); });
    },
    getPublic(slug: string) { return database.query("SELECT * FROM gyca_editorial_content WHERE slug=$1 AND status='published'", [slug]).then(result => {
      if (result.rows[0] === undefined) throw new EntryFault("NOT_FOUND", 404); return publicItem(result.rows[0]); }); },
    listPublic(category: (typeof EDITORIAL_CATEGORIES)[number] | null, cursor: ReturnType<typeof decodeEditorialPublicCursor>, limit: number) {
      return database.query(`SELECT * FROM gyca_editorial_content WHERE status='published' AND ($1::text IS NULL OR category=$1)
        AND ($2::timestamptz IS NULL OR (published_at,id)<($2::timestamptz,$3::uuid)) ORDER BY published_at DESC,id DESC LIMIT $4`,
      [category, cursor?.publishedAt ?? null, cursor?.id ?? null, limit + 1]).then(result => { const rows = result.rows.map(publicItem);
        const page = rows.slice(0, limit); return EditorialPublicPageSchema.parse({ items: page,
          nextCursor: rows.length > limit && page.length ? encodePublicCursor(page.at(-1)!, category) : null }); });
    },
  };
}
