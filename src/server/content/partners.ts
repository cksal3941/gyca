import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { PARTNER_RELATIONSHIP_STATUSES, PARTNER_STATUSES, PARTNER_TYPES, PartnerAdminItemSchema, PartnerAdminPageSchema,
  PartnerBodySchema, PartnerPublicItemSchema, PartnerPublicPageSchema } from "../../contracts/partner-content.ts";
import type { PartnerBody } from "../../contracts/partner-content.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ id: z.uuid(), slug: z.string(), partner_type: z.enum(PARTNER_TYPES), status: z.enum(PARTNER_STATUSES),
  relationship_status: z.enum(PARTNER_RELATIONSHIP_STATUSES), revision: z.number().int().positive(), content: z.unknown(),
  created_at: z.coerce.date(), updated_at: z.coerce.date(), published_at: z.coerce.date().nullable() });
const cursorSchema = z.object({ v: z.literal(1), partnerType: z.enum(PARTNER_TYPES).nullable(), displayOrder: z.number().int(), id: z.uuid() });
function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function allowed(row: z.infer<typeof rowSchema>) {
  if (row.status === "archived" || row.relationship_status === "revoked") return [] as const;
  if (row.relationship_status === "pending") return ["edit", "confirm_relationship", "archive"] as const;
  return row.status === "draft" ? ["edit", "publish", "archive", "revoke_relationship"] as const
    : ["edit", "archive", "revoke_relationship"] as const;
}
function adminItem(raw: unknown) { const row = rowSchema.parse(raw); return PartnerAdminItemSchema.parse({ id: row.id, slug: row.slug,
  partnerType: row.partner_type, status: row.status, relationshipStatus: row.relationship_status, revision: row.revision,
  content: row.content, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  publishedAt: row.published_at?.toISOString() ?? null, allowedActions: allowed(row) }); }
function publicItem(raw: unknown) { const row = rowSchema.parse(raw);
  if (row.status !== "published" || row.relationship_status !== "confirmed" || row.published_at === null) throw new EntryFault("NOT_FOUND", 404);
  return PartnerPublicItemSchema.parse({ id: row.id, slug: row.slug, partnerType: row.partner_type,
    content: row.content, publishedAt: row.published_at.toISOString() }); }
async function authorize(db: SqlConnection, actor: string) { if (!(await db.query(
  "SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length) throw new EntryFault("FORBIDDEN", 403); }
async function replay(db: SqlConnection, actor: string, actionId: string, requestHash: string) {
  const raw = (await db.query("SELECT request_hash,response FROM gyca_partner_actions WHERE actor_id=$1 AND action_id=$2", [actor, actionId])).rows[0];
  if (raw === undefined) return null; const row = z.object({ request_hash: z.string(), response: z.unknown() }).parse(raw);
  if (row.request_hash !== requestHash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409); return PartnerAdminItemSchema.parse(row.response);
}
async function saveAction(db: SqlConnection, actor: string, actionId: string, requestHash: string, response: unknown, at: Date) {
  await db.query("INSERT INTO gyca_partner_actions(actor_id,action_id,request_hash,response,created_at) VALUES($1,$2,$3,$4::jsonb,$5)",
    [actor, actionId, requestHash, JSON.stringify(response), at]);
}
export function decodePartnerCursor(value: string | null, partnerType: (typeof PARTNER_TYPES)[number] | null) {
  if (value === null) return null;
  try { const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.partnerType !== partnerType) throw new Error("filter mismatch"); return parsed;
  } catch { throw new EntryFault("VALIDATION_FAILED", 422); }
}
function encodeCursor(item: z.infer<typeof PartnerPublicItemSchema>, partnerType: (typeof PARTNER_TYPES)[number] | null) {
  return Buffer.from(JSON.stringify({ v: 1, partnerType, displayOrder: item.content.displayOrder, id: item.id })).toString("base64url");
}

export function createPartnerService(database: EntryDatabase, now: () => Date) {
  async function simpleTransition(actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number }, target: "published" | "archived") {
    return database.transaction(async db => { await authorize(db, actor); const requestHash = digest({ id, target, ...input });
      const saved = await replay(db, actor, input.actionId, requestHash); if (saved !== null) return saved;
      const raw = (await db.query("SELECT * FROM gyca_partners WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
      if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      if ((target === "published" && (row.status !== "draft" || row.relationship_status !== "confirmed"))
        || (target === "archived" && row.status === "archived")) throw new EntryFault("ENTRY_LOCKED", 409);
      const at = now(); const revision = row.revision + 1; const reason = target === "published" ? "published" : "archived";
      await db.query(`INSERT INTO gyca_partner_changes(partner_id,revision,status,relationship_status,snapshot,actor_id,reason,created_at)
        VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [id, revision, target, row.relationship_status, JSON.stringify(row.content), actor, reason, at]);
      const updated = (await db.query(`UPDATE gyca_partners SET status=$2,revision=$3,updated_at=$4,
        published_at=CASE WHEN $2='published' THEN $4 ELSE published_at END WHERE id=$1 RETURNING *`, [id, target, revision, at])).rows[0];
      const result = adminItem(updated); await saveAction(db, actor, input.actionId, requestHash, result, at); return result; });
  }
  async function relationship(actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number;
    readonly evidenceReference: string; readonly reason: string }, target: "confirmed" | "revoked") {
    return database.transaction(async db => { await authorize(db, actor); const requestHash = digest({ id, target, ...input });
      const saved = await replay(db, actor, input.actionId, requestHash); if (saved !== null) return saved;
      const raw = (await db.query("SELECT * FROM gyca_partners WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
      if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      if ((target === "confirmed" && (row.relationship_status !== "pending" || row.status !== "draft"))
        || (target === "revoked" && (row.relationship_status !== "confirmed" || row.status === "archived"))) throw new EntryFault("ENTRY_LOCKED", 409);
      const at = now(); const revision = row.revision + 1; const status = target === "revoked" ? "archived" : row.status;
      const reason = target === "confirmed" ? "relationship_confirmed" : "relationship_revoked";
      await db.query(`INSERT INTO gyca_partner_relationship_events(partner_id,revision,relationship_status,actor_id,evidence_reference,reason,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [id, revision, target, actor, input.evidenceReference, input.reason, at]);
      await db.query(`INSERT INTO gyca_partner_changes(partner_id,revision,status,relationship_status,snapshot,actor_id,reason,created_at)
        VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [id, revision, status, target, JSON.stringify(row.content), actor, reason, at]);
      const updated = (await db.query("UPDATE gyca_partners SET status=$2,relationship_status=$3,revision=$4,updated_at=$5 WHERE id=$1 RETURNING *",
        [id, status, target, revision, at])).rows[0]; const result = adminItem(updated);
      await saveAction(db, actor, input.actionId, requestHash, result, at); return result; });
  }
  return {
    create(actor: string, input: { readonly actionId: string; readonly slug: string; readonly partnerType: (typeof PARTNER_TYPES)[number]; readonly content: PartnerBody }) {
      return database.transaction(async db => { await authorize(db, actor); const requestHash = digest(input);
        const saved = await replay(db, actor, input.actionId, requestHash); if (saved !== null) return saved; const at = now(); const id = randomUUID();
        const inserted = (await db.query(`INSERT INTO gyca_partners(id,slug,partner_type,status,relationship_status,revision,content,created_by,created_at,updated_at)
          VALUES($1,$2,$3,'draft','pending',1,$4::jsonb,$5,$6,$6) ON CONFLICT(slug) DO NOTHING RETURNING *`,
        [id, input.slug, input.partnerType, JSON.stringify(input.content), actor, at])).rows[0];
        if (inserted === undefined) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        await db.query(`INSERT INTO gyca_partner_changes(partner_id,revision,status,relationship_status,snapshot,actor_id,reason,created_at)
          VALUES($1,1,'draft','pending',$2::jsonb,$3,'created',$4)`, [id, JSON.stringify(input.content), actor, at]);
        const result = adminItem(inserted); await saveAction(db, actor, input.actionId, requestHash, result, at); return result; });
    },
    update(actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number; readonly content: PartnerBody }) {
      return database.transaction(async db => { await authorize(db, actor); const requestHash = digest({ id, ...input });
        const saved = await replay(db, actor, input.actionId, requestHash); if (saved !== null) return saved;
        const raw = (await db.query("SELECT * FROM gyca_partners WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404); const row = rowSchema.parse(raw);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.status === "archived" || row.relationship_status === "revoked") throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now(); const revision = row.revision + 1; const content = PartnerBodySchema.parse(input.content);
        await db.query(`INSERT INTO gyca_partner_changes(partner_id,revision,status,relationship_status,snapshot,actor_id,reason,created_at)
          VALUES($1,$2,$3,$4,$5::jsonb,$6,'edited',$7)`, [id, revision, row.status, row.relationship_status, JSON.stringify(content), actor, at]);
        const updated = (await db.query("UPDATE gyca_partners SET content=$2::jsonb,revision=$3,updated_at=$4 WHERE id=$1 RETURNING *",
          [id, JSON.stringify(content), revision, at])).rows[0]; const result = adminItem(updated);
        await saveAction(db, actor, input.actionId, requestHash, result, at); return result; });
    },
    confirm: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number; readonly evidenceReference: string; readonly reason: string }) => relationship(actor, id, input, "confirmed"),
    revoke: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number; readonly evidenceReference: string; readonly reason: string }) => relationship(actor, id, input, "revoked"),
    publish: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number }) => simpleTransition(actor, id, input, "published"),
    archive: (actor: string, id: string, input: { readonly actionId: string; readonly expectedRevision: number }) => simpleTransition(actor, id, input, "archived"),
    getAdmin(actor: string, id: string) { return database.transaction(async db => { await authorize(db, actor);
      const row = (await db.query("SELECT * FROM gyca_partners WHERE id=$1", [id])).rows[0]; if (!row) throw new EntryFault("NOT_FOUND", 404); return adminItem(row); }); },
    listAdmin(actor: string, filters: { readonly status: string | null; readonly relationshipStatus: string | null; readonly cursor: string | null; readonly limit: number }) {
      return database.transaction(async db => { await authorize(db, actor); const rows = (await db.query(`SELECT * FROM gyca_partners
        WHERE ($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR relationship_status=$2)
          AND ($3::uuid IS NULL OR id>$3) ORDER BY id LIMIT $4`, [filters.status, filters.relationshipStatus, filters.cursor, filters.limit + 1])).rows.map(adminItem);
        const page = rows.slice(0, filters.limit); return PartnerAdminPageSchema.parse({ items: page,
          nextCursor: rows.length > filters.limit ? page.at(-1)?.id ?? null : null }); });
    },
    getPublic(slug: string) { return database.query("SELECT * FROM gyca_partners WHERE slug=$1 AND status='published' AND relationship_status='confirmed'", [slug])
      .then(result => { if (!result.rows[0]) throw new EntryFault("NOT_FOUND", 404); return publicItem(result.rows[0]); }); },
    listPublic(partnerType: (typeof PARTNER_TYPES)[number] | null, cursor: ReturnType<typeof decodePartnerCursor>, limit: number) {
      return database.query(`SELECT * FROM gyca_partners WHERE status='published' AND relationship_status='confirmed'
        AND ($1::text IS NULL OR partner_type=$1) AND ($2::int IS NULL OR ((content->>'displayOrder')::int,id)>($2,$3::uuid))
        ORDER BY (content->>'displayOrder')::int,id LIMIT $4`, [partnerType, cursor?.displayOrder ?? null, cursor?.id ?? null, limit + 1]).then(result => {
        const rows = result.rows.map(publicItem); const page = rows.slice(0, limit); return PartnerPublicPageSchema.parse({ items: page,
          nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!, partnerType) : null }); });
    },
  };
}
