import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { UploadStorage } from "../uploads/storage.ts";
import { createBlindPdfCandidate } from "./blind-pdf.ts";

const MAX_ATTEMPTS = 8; const MAX_BYTES = 64 * 1024 * 1024; const LEASE_MS = 120000;
const jobSchema = z.object({ assignment_id: z.uuid(), source_key: z.string(), source_version: z.string(), target_key: z.string(), attempts: z.number().int() });
type Outcome = "idle" | "completed" | "retry_scheduled" | "stalled" | "superseded";

export function createBlindAssetWorker(database: EntryDatabase, storage: UploadStorage | null, now: () => Date) {
  return { async runOnce(): Promise<{ readonly outcome: Outcome }> {
    if (!storage?.readVersion || !storage.writeImmutable) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
    const claimed = await database.transaction(async db => {
      const at = now();
      const raw = (await db.query(`SELECT j.assignment_id,j.source_key,j.source_version,j.target_key,j.attempts FROM gyca_blind_asset_jobs j
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=j.assignment_id
        WHERE v.assignment_id IS NULL AND ((j.state='pending' AND j.due_at<=$1) OR (j.state='running' AND j.lease_until<=$1))
        ORDER BY j.due_at,j.assignment_id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`, [at])).rows[0];
      if (!raw) return null;
      const job = jobSchema.parse(raw);
      if (job.attempts >= MAX_ATTEMPTS) {
        await db.query(`UPDATE gyca_blind_asset_jobs SET state='stalled',lease_token=NULL,lease_until=NULL,
          last_error_code=COALESCE(last_error_code,'RETRY_LIMIT') WHERE assignment_id=$1`, [job.assignment_id]);
        await db.query(`INSERT INTO gyca_blind_asset_events VALUES($1,$2,$3,'stalled','RETRY_LIMIT',NULL,$4)`,
          [randomUUID(), job.assignment_id, job.attempts, at]);
        return { stalled: true } as const;
      }
      const token = randomUUID();
      await db.query(`UPDATE gyca_blind_asset_jobs SET state='running',attempts=attempts+1,lease_token=$2,lease_until=$3
        WHERE assignment_id=$1`, [job.assignment_id, token, new Date(at.getTime() + LEASE_MS)]);
      return { job, token, stalled: false } as const;
    });
    if (!claimed) return { outcome: "idle" }; if (claimed.stalled) return { outcome: "stalled" };
    let candidate: Awaited<ReturnType<typeof createBlindPdfCandidate>> | null = null; let version: string | null = null; let errorCode: string | null = null;
    try {
      const source = await storage.readVersion({ key: claimed.job.source_key, version: claimed.job.source_version, maxBytes: MAX_BYTES });
      if (!source) throw new EntryFault("FILE_NOT_READY", 409);
      candidate = await createBlindPdfCandidate(source.bytes);
      try { version = (await storage.writeImmutable({ key: claimed.job.target_key, bytes: candidate.bytes, mediaType: "application/pdf" })).version; }
      catch (writeError) {
        // A create-only PUT may have reached S3 even when its response was lost. Recover only an exact byte match.
        const existing = await storage.readImmutable(claimed.job.target_key, MAX_BYTES);
        const checksum = existing && createHash("sha256").update(existing.bytes).digest("hex");
        if (!existing || checksum !== candidate.checksum) throw writeError;
        version = existing.version;
      }
    } catch (error) { errorCode = error instanceof EntryFault ? error.code : "INTERNAL_ERROR"; }
    return database.transaction(async db => {
      const at = now(); const attempt = claimed.job.attempts + 1;
      if (candidate && version) {
        const updated = await db.query(`UPDATE gyca_blind_asset_jobs SET state='pending_review',lease_token=NULL,lease_until=NULL,
          candidate_version=$3,candidate_checksum=$4,page_count=$5,last_error_code=NULL,transformed_at=$6
          WHERE assignment_id=$1 AND state='running' AND lease_token=$2 RETURNING assignment_id`,
          [claimed.job.assignment_id, claimed.token, version, candidate.checksum, candidate.pageCount, at]);
        if (!updated.rows.length) return { outcome: "superseded" as const };
        await db.query(`INSERT INTO gyca_blind_asset_events VALUES($1,$2,$3,'transformed',NULL,NULL,$4)`,
          [randomUUID(), claimed.job.assignment_id, attempt, at]);
        return { outcome: "completed" as const };
      }
      const state = attempt >= MAX_ATTEMPTS ? "stalled" : "pending";
      const due = new Date(at.getTime() + Math.min(3600000, 30000 * 2 ** Math.min(attempt - 1, 7)));
      const updated = await db.query(`UPDATE gyca_blind_asset_jobs SET state=$3,due_at=$4,lease_token=NULL,lease_until=NULL,last_error_code=$5
        WHERE assignment_id=$1 AND state='running' AND lease_token=$2 RETURNING assignment_id`,
        [claimed.job.assignment_id, claimed.token, state, due, errorCode]);
      if (!updated.rows.length) return { outcome: "superseded" as const };
      const outcome = state === "stalled" ? "stalled" : "retry_scheduled";
      await db.query(`INSERT INTO gyca_blind_asset_events VALUES($1,$2,$3,$4,$5,NULL,$6)`,
        [randomUUID(), claimed.job.assignment_id, attempt, outcome, errorCode, at]);
      return { outcome };
    });
  } };
}
