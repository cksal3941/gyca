import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { UploadStorage } from "./storage.ts";

const MAX_ATTEMPTS = 8;
const LEASE_MS = 120000;
const jobSchema = z.object({ asset_id: z.uuid(), object_key: z.string(), object_version: z.string(), attempts: z.number().int() });
type Outcome = "idle" | "completed" | "retry_scheduled" | "stalled" | "superseded";

export function createAssetRetentionWorker(database: EntryDatabase, storage: UploadStorage | null, now: () => Date) {
  return {
    async runOnce(): Promise<{ readonly outcome: Outcome }> {
      if (!storage?.deleteImmutable) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      const claimed = await database.transaction(async db => {
        const at = now();
        const raw = (await db.query(`SELECT asset_id,object_key,object_version,attempts
          FROM gyca_asset_deletion_jobs
          WHERE (state='pending' AND due_at<=$1) OR (state='running' AND lease_until<=$1)
          ORDER BY due_at,asset_id LIMIT 1 FOR UPDATE SKIP LOCKED`, [at])).rows[0];
        if (!raw) return null;
        const job = jobSchema.parse(raw);
        if (job.attempts >= MAX_ATTEMPTS) {
          await db.query(`UPDATE gyca_asset_deletion_jobs SET state='stalled',lease_token=NULL,lease_until=NULL,
            last_error_code=COALESCE(last_error_code,'RETRY_LIMIT') WHERE asset_id=$1`, [job.asset_id]);
          await db.query(`INSERT INTO gyca_asset_deletion_events(id,asset_id,attempt,outcome,error_code,created_at)
            VALUES($1,$2,$3,'stalled','RETRY_LIMIT',$4)`, [randomUUID(), job.asset_id, job.attempts, at]);
          return { stalled: true } as const;
        }
        const token = randomUUID();
        await db.query(`UPDATE gyca_asset_deletion_jobs SET state='running',attempts=attempts+1,
          lease_token=$2,lease_until=$3 WHERE asset_id=$1`, [job.asset_id, token, new Date(at.getTime() + LEASE_MS)]);
        return { job, token, stalled: false } as const;
      });
      if (!claimed) return { outcome: "idle" };
      if (claimed.stalled) return { outcome: "stalled" };
      let errorCode: string | null = null;
      try { await storage.deleteImmutable({ key: claimed.job.object_key, version: claimed.job.object_version }); }
      catch (error) { errorCode = error instanceof EntryFault ? error.code : "INTERNAL_ERROR"; }
      return database.transaction(async db => {
        const at = now();
        const attempt = claimed.job.attempts + 1;
        const state = errorCode === null ? "completed" : attempt >= MAX_ATTEMPTS ? "stalled" : "pending";
        const due = new Date(at.getTime() + Math.min(3600000, 30000 * 2 ** Math.min(attempt - 1, 7)));
        const updated = await db.query(`UPDATE gyca_asset_deletion_jobs SET state=$3,due_at=$4,
          lease_token=NULL,lease_until=NULL,last_error_code=$5,completed_at=CASE WHEN $3::text='completed' THEN $6::timestamptz ELSE NULL END
          WHERE asset_id=$1 AND state='running' AND lease_token=$2 RETURNING asset_id`,
          [claimed.job.asset_id, claimed.token, state, due, errorCode, at]);
        if (!updated.rows.length) return { outcome: "superseded" as const };
        const outcome = state === "pending" ? "retry_scheduled" : state;
        if (state === "completed") await db.query("UPDATE gyca_assets SET removed_at=COALESCE(removed_at,$2) WHERE id=$1", [claimed.job.asset_id, at]);
        await db.query(`INSERT INTO gyca_asset_deletion_events(id,asset_id,attempt,outcome,error_code,created_at)
          VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), claimed.job.asset_id, attempt, outcome, errorCode, at]);
        return { outcome: outcome as Exclude<Outcome, "idle" | "superseded"> };
      });
    },
  };
}
