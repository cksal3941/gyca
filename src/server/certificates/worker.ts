import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { UploadStorage } from "../uploads/storage.ts";
import { createCertificatePdf } from "./pdf.ts";

const MAX_ATTEMPTS = 8; const MAX_BYTES = 4 * 1024 * 1024; const LEASE_MS = 120000;
const jobSchema = z.object({ id: z.uuid(), object_key: z.string(), snapshot: z.unknown(), attempts: z.number().int() });
type Outcome = "idle" | "completed" | "retry_scheduled" | "stalled" | "superseded";

export function createCertificateWorker(database: EntryDatabase, storage: UploadStorage | null, now: () => Date) {
  return { async runOnce(): Promise<{ readonly outcome: Outcome }> {
    if (!storage?.writeImmutable) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
    const claimed = await database.transaction(async db => {
      const at = now();
      const raw = (await db.query(`SELECT id,object_key,snapshot,attempts FROM gyca_certificates
        WHERE (state='pending' AND due_at<=$1) OR (state='running' AND lease_until<=$1)
        ORDER BY due_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`, [at])).rows[0];
      if (!raw) return null;
      const job = jobSchema.parse(raw);
      if (job.attempts >= MAX_ATTEMPTS) {
        await db.query("UPDATE gyca_certificates SET state='stalled',lease_token=NULL,lease_until=NULL,last_error_code=COALESCE(last_error_code,'RETRY_LIMIT') WHERE id=$1", [job.id]);
        await db.query("INSERT INTO gyca_certificate_events VALUES($1,$2,$3,'stalled','RETRY_LIMIT',$4)", [randomUUID(), job.id, job.attempts, at]);
        return { stalled: true } as const;
      }
      const token = randomUUID();
      await db.query(`UPDATE gyca_certificates SET state='running',attempts=attempts+1,lease_token=$2,lease_until=$3 WHERE id=$1`,
        [job.id, token, new Date(at.getTime() + LEASE_MS)]);
      return { job, token, stalled: false } as const;
    });
    if (!claimed) return { outcome: "idle" }; if (claimed.stalled) return { outcome: "stalled" };
    let candidate: Awaited<ReturnType<typeof createCertificatePdf>> | null = null;
    let version: string | null = null; let errorCode: string | null = null;
    try {
      candidate = await createCertificatePdf(claimed.job.snapshot);
      try { version = (await storage.writeImmutable({ key: claimed.job.object_key, bytes: candidate.bytes, mediaType: "application/pdf" })).version; }
      catch (writeError) {
        const existing = await storage.readImmutable(claimed.job.object_key, MAX_BYTES);
        const checksum = existing && createHash("sha256").update(existing.bytes).digest("hex");
        if (!existing || checksum !== candidate.checksum) throw writeError;
        version = existing.version;
      }
    } catch (error) { errorCode = error instanceof EntryFault ? error.code : "INTERNAL_ERROR"; }
    return database.transaction(async db => {
      const at = now(); const attempt = claimed.job.attempts + 1;
      if (candidate && version) {
        const updated = await db.query(`UPDATE gyca_certificates SET state='issued',object_version=$3,checksum=$4,issued_at=$5,
          lease_token=NULL,lease_until=NULL,last_error_code=NULL WHERE id=$1 AND state='running' AND lease_token=$2 RETURNING entry_id`,
        [claimed.job.id, claimed.token, version, candidate.checksum, at]);
        const row = updated.rows[0]; if (!row) return { outcome: "superseded" as const };
        const entry = z.object({ entry_id: z.uuid() }).parse(row).entry_id;
        await db.query(`UPDATE gyca_entries e SET certificate_count=(SELECT count(*)::integer FROM gyca_certificates c
          WHERE c.entry_id=e.id AND c.state='issued') WHERE e.id=$1`, [entry]);
        await db.query("INSERT INTO gyca_certificate_events VALUES($1,$2,$3,'issued',NULL,$4)", [randomUUID(), claimed.job.id, attempt, at]);
        return { outcome: "completed" as const };
      }
      const state = attempt >= MAX_ATTEMPTS ? "stalled" : "pending";
      const due = new Date(at.getTime() + Math.min(3600000, 30000 * 2 ** Math.min(attempt - 1, 7)));
      const updated = await db.query(`UPDATE gyca_certificates SET state=$3,due_at=$4,lease_token=NULL,lease_until=NULL,last_error_code=$5
        WHERE id=$1 AND state='running' AND lease_token=$2 RETURNING id`, [claimed.job.id, claimed.token, state, due, errorCode]);
      if (!updated.rows.length) return { outcome: "superseded" as const };
      const outcome = state === "stalled" ? "stalled" : "retry_scheduled";
      await db.query("INSERT INTO gyca_certificate_events VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), claimed.job.id, attempt, outcome, errorCode, at]);
      return { outcome };
    });
  } };
}
