import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { AssetSchema } from "../../contracts/index.ts";
import type { Asset } from "../../contracts/index.ts";
import { UploadSessionSchema } from "../../contracts/uploads.ts";
import type { UploadRequest } from "../../contracts/uploads.ts";
import { CompetitionRowSchema, draftPolicyError, projectCompetition } from "../competitions/policy.ts";
import { EntryFault } from "../entries/errors.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import type { UploadStorage } from "./storage.ts";
import type { Inspection, InspectionOptions } from "./inspect.ts";
import { MAX_UPLOAD_BYTES, supportsUploadRule } from "./policy.ts";

const entrySchema = z.object({ id: z.string(), competition_id: z.string(), status: z.string(), revision: z.number().int() });
const assetRow = z.object({ id: z.string(), entry_id: z.string(), request_hash: z.string(), purpose: z.string(),
  display_name: z.string(), declared_size: z.coerce.number(), declared_type: z.string(), max_bytes: z.coerce.number(),
  min_pages: z.number().nullable(), object_key: z.string(), state: z.string(), size_bytes: z.coerce.number(),
  page_count: z.number().nullable(), rejection_code: z.string().nullable(), expires_at: z.coerce.date(),
  validation_token: z.string().nullable(), validation_started_at: z.coerce.date().nullable(),
});
type AssetRow = z.infer<typeof assetRow>;
function dto(row: AssetRow): Asset {
  return AssetSchema.parse({ id: row.id, purpose: row.purpose, displayName: row.display_name,
    sizeBytes: row.size_bytes, state: row.state, pageCount: row.page_count, rejectionCode: row.rejection_code });
}
async function entry(db: SqlConnection, owner: string, id: string, writable: boolean, now: Date) {
  const result = await db.query(`SELECT id,competition_id,status,revision FROM gyca_entries WHERE id=$1 AND owner_id=$2${writable ? " FOR UPDATE" : ""}`, [id, owner]);
  if (result.rows[0] === undefined) throw new EntryFault("NOT_FOUND", 404);
  const value = entrySchema.parse(result.rows[0]);
  if (writable) {
    if (value.status !== "draft") throw new EntryFault("ENTRY_LOCKED", 409);
    const rows = await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR SHARE", [value.competition_id]);
    const policy = CompetitionRowSchema.parse(rows.rows[0]);
    const blocked = draftPolicyError(policy, now);
    if (blocked !== null) throw blocked;
  }
  return value;
}
async function asset(db: SqlConnection, entryId: string, id: string): Promise<AssetRow> {
  const result = await db.query("SELECT * FROM gyca_assets WHERE id=$1 AND entry_id=$2 AND removed_at IS NULL", [id, entryId]);
  if (result.rows[0] === undefined) throw new EntryFault("NOT_FOUND", 404);
  return assetRow.parse(result.rows[0]);
}

export function createUploadService(database: EntryDatabase, storage: UploadStorage | null,
  inspect: (bytes: Uint8Array, options: InspectionOptions) => Promise<Inspection>, now: () => Date) {
  return {
    async list(owner: string, entryId: string): Promise<readonly Asset[]> {
      await entry(database, owner, entryId, false, now());
      const result = await database.query("SELECT * FROM gyca_assets WHERE entry_id=$1 AND removed_at IS NULL ORDER BY created_at,id", [entryId]);
      return z.array(assetRow).parse(result.rows).map(dto);
    },
    async create(owner: string, entryId: string, key: string, input: UploadRequest) {
      const reservation = await database.transaction(async (db) => {
        const current = await entry(db, owner, entryId, true, now());
        if (storage === null) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
        const existing = await db.query("SELECT * FROM gyca_assets WHERE entry_id=$1 AND request_key=$2", [entryId, key]);
        if (existing.rows[0] !== undefined) {
          const previous = assetRow.parse(existing.rows[0]);
          if (previous.request_hash !== hash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          const active = await asset(db, entryId, previous.id);
          return { row: active, revision: current.revision };
        }
        if (current.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
        const total = await db.query("SELECT count(*)::integer AS count FROM gyca_assets WHERE entry_id=$1", [entryId]);
        if (z.object({ count: z.number() }).parse(total.rows[0]).count >= 128) throw new EntryFault("UPLOAD_LIMIT_REACHED", 409);
        const policies = await db.query("SELECT * FROM gyca_competitions WHERE id=$1", [current.competition_id]);
        const competition = projectCompetition(CompetitionRowSchema.parse(policies.rows[0]), now());
        const rule = competition?.formSpec?.uploads.find((u) => u.purpose === input.purpose);
        if (rule === undefined || rule.maxBytes === null) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        if (!rule.allowedMediaTypes.includes(input.mediaType)) throw new EntryFault("VALIDATION_FAILED", 422);
        if (!supportsUploadRule(rule)) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        const maxBytes = Math.min(rule.maxBytes, MAX_UPLOAD_BYTES);
        if (input.sizeBytes > maxBytes) throw new EntryFault("FILE_TOO_LARGE", 413);
        const count = await db.query(`SELECT count(*)::integer AS count FROM gyca_assets WHERE entry_id=$1 AND purpose=$2
          AND removed_at IS NULL AND state <> 'rejected' AND (state <> 'pending_upload' OR expires_at>$3)`, [entryId, input.purpose, now()]);
        if (z.object({ count: z.number() }).parse(count.rows[0]).count >= rule.maxFiles) throw new EntryFault("UPLOAD_LIMIT_REACHED", 409);
        const id = randomUUID();
        const closes = competition?.submissionClosesAtExclusive;
        if (!closes) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        const expires = new Date(Math.min(now().getTime() + 15 * 60 * 1000, Date.parse(closes)));
        await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,min_pages,object_key,expires_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, entryId, key, hash, input.purpose, input.filename, input.sizeBytes, input.mediaType, maxBytes, rule.minPages, `quarantine/${entryId}/${id}`, expires]);
        await db.query("UPDATE gyca_entries SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1", [entryId]);
        return { row: await asset(db, entryId, id), revision: current.revision + 1 };
      });
      const { row, revision } = reservation;
      if (row.state === "pending_upload" && row.expires_at <= now()) throw new EntryFault("UPLOAD_EXPIRED", 409);
      if (storage === null) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      const upload = row.state === "pending_upload" ? await storage.signCreate({ key: row.object_key, mediaType: row.declared_type,
        sizeBytes: row.declared_size, expiresAt: row.expires_at }) : null;
      return UploadSessionSchema.parse({ asset: dto(row), revision, expiresAt: row.expires_at.toISOString(), upload });
    },
    async complete(owner: string, entryId: string, assetId: string): Promise<Asset> {
      const claim = await database.transaction(async (db) => {
        await entry(db, owner, entryId, true, now());
        const row = await asset(db, entryId, assetId);
        if (row.state === "ready" || row.state === "rejected") return { row, token: null };
        if (row.state === "validating" && row.validation_started_at !== null && now().getTime() - row.validation_started_at.getTime() < 120000)
          return { row, token: null };
        if (row.expires_at <= now()) throw new EntryFault("UPLOAD_EXPIRED", 409);
        if (storage === null) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        const token = randomUUID();
        await db.query("UPDATE gyca_assets SET state='validating',validation_token=$2,validation_started_at=$3 WHERE id=$1", [assetId, token, now()]);
        return { row, token };
      });
      if (claim.token === null) return dto(claim.row);
      try {
        if (storage === null) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        const stored = await storage.readImmutable(claim.row.object_key, claim.row.max_bytes);
        if (stored === null) throw new EntryFault("FILE_NOT_READY", 409);
        const result = await inspect(stored.bytes, { mediaType: claim.row.declared_type, maxBytes: claim.row.max_bytes, minPages: claim.row.min_pages });
        const accepted = result.state === "ready" && result.sizeBytes === claim.row.declared_size;
        return await database.transaction(async (db) => {
          await entry(db, owner, entryId, true, now());
          const current = await asset(db, entryId, assetId);
          if (current.validation_token !== claim.token) return dto(current);
          await db.query(`UPDATE gyca_assets SET state=$2,size_bytes=$3,page_count=$4,rejection_code=$5,checksum=$6,object_version=$7,
            validation_token=NULL,validation_started_at=NULL WHERE id=$1`, [assetId, accepted ? "ready" : "rejected", result.sizeBytes,
          result.pageCount, accepted ? null : (result.rejectionCode ?? "FILE_CORRUPTED"), result.checksum, stored.version]);
          return dto(await asset(db, entryId, assetId));
        });
      } catch (error) {
        await database.query("UPDATE gyca_assets SET state='pending_upload',validation_token=NULL,validation_started_at=NULL WHERE id=$1 AND validation_token=$2 AND removed_at IS NULL", [assetId, claim.token]);
        throw error;
      }
    },
    remove: (owner: string, entryId: string, assetId: string, revision: number) => database.transaction(async (db) => {
      const current = await entry(db, owner, entryId, true, now());
      if (current.revision !== revision) throw new EntryFault("REVISION_CONFLICT", 409);
      await asset(db, entryId, assetId);
      await db.query("UPDATE gyca_assets SET removed_at=$2 WHERE id=$1", [assetId, now()]);
      await db.query("UPDATE gyca_entries SET revision=revision+1,updated_at=clock_timestamp() WHERE id=$1", [entryId]);
      return { revision: revision + 1 };
    }),
  };
}
