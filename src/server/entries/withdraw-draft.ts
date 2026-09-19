import { z } from "zod";
import { DraftWithdrawalSchema, WithdrawDraftRequestSchema } from "../../contracts/draft-withdrawal.ts";
import { RetentionPolicySchema } from "../../contracts/retention-policy.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "./http.ts";

export function createWithdrawDraftHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, entryId: string) => run(request, true, 200, async owner => {
    const id = parseRequest(z.uuid(), entryId);
    const input = parseRequest(WithdrawDraftRequestSchema, await jsonBody(request));
    return deps.database.transaction(async db => {
      const raw = (await db.query(`SELECT e.status,e.revision,e.submitted_at,e.updated_at,e.competition_id,c.retention_policy
        FROM gyca_entries e JOIN gyca_competitions c ON c.id=e.competition_id
        WHERE e.id=$1 AND e.owner_id=$2 FOR UPDATE OF e`, [id, owner])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ status: z.string(), revision: z.number().int(), submitted_at: z.date().nullable(), updated_at: z.date(),
        competition_id: z.string(), retention_policy: z.unknown().nullable() }).parse(raw);
      if ((await db.query("SELECT entry_id FROM gyca_submissions WHERE entry_id=$1 UNION ALL SELECT entry_id FROM gyca_orders WHERE entry_id=$1", [id])).rows.length || row.submitted_at)
        throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.status === "withdrawn" && row.revision === input.revision + 1) {
        const saved = (await db.query(`SELECT withdrawn_at FROM gyca_draft_withdrawals
          WHERE entry_id=$1 AND actor_id=$2 AND previous_revision=$3 AND resulting_revision=$4`, [id, owner, input.revision, row.revision])).rows[0];
        if (!saved) throw new EntryFault("ENTRY_LOCKED", 409);
        const audit = z.object({ withdrawn_at: z.date() }).parse(saved);
        return DraftWithdrawalSchema.parse({ entryId: id, revision: row.revision, entryStatus: "withdrawn", withdrawnAt: audit.withdrawn_at.toISOString() });
      }
      if (row.status !== "draft") throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
      const at = deps.now();
      const assets = (await db.query(`SELECT id,object_key,object_version FROM gyca_assets
        WHERE entry_id=$1 AND removed_at IS NULL AND object_version IS NOT NULL`, [id])).rows;
      await db.query("UPDATE gyca_entries SET status='withdrawn',revision=revision+1,updated_at=$2 WHERE id=$1", [id, at]);
      await db.query("UPDATE gyca_assets SET removed_at=$2,validation_token=NULL,validation_started_at=NULL WHERE entry_id=$1 AND removed_at IS NULL", [id, at]);
      const policy = RetentionPolicySchema.safeParse(row.retention_policy);
      if (policy.success) {
        const due = new Date(at.getTime() + policy.data.withdrawnDraftAssets.deleteAfterDays * 86400000);
        for (const asset of assets) {
          const saved = z.object({ id: z.uuid(), object_key: z.string(), object_version: z.string().min(1).refine(v => v !== "null") }).safeParse(asset);
          if (saved.success) await db.query(`INSERT INTO gyca_asset_deletion_jobs
            (asset_id,entry_id,competition_id,object_key,object_version,reason,policy_version,due_at,created_at)
            VALUES($1,$2,$3,$4,$5,'withdrawn_draft',$6,$7,$8) ON CONFLICT DO NOTHING`,
            [saved.data.id, id, row.competition_id, saved.data.object_key, saved.data.object_version, policy.data.version, due, at]);
        }
      }
      await db.query(`INSERT INTO gyca_draft_withdrawals(entry_id,actor_id,previous_revision,resulting_revision,withdrawn_at)
        VALUES($1,$2,$3,$4,$5)`, [id, owner, row.revision, row.revision + 1, at]);
      return DraftWithdrawalSchema.parse({ entryId: id, revision: row.revision + 1, entryStatus: "withdrawn", withdrawnAt: at.toISOString() });
    });
  });
}
