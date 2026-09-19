import { z } from "zod";
import type { SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

export async function checkGuardianMailLimit(db: SqlConnection, owner: string, now: () => Date) {
  // Hold this transaction lock through request insertion so different entries share one quota.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`guardian_mail_owner:${owner}`]);
  const at = now();
  const row = (await db.query(`SELECT count(*)::integer AS count FROM gyca_guardian_requests r
    JOIN gyca_entries e ON e.id=r.entry_id WHERE e.owner_id=$1 AND r.created_at>$2`,
    [owner, new Date(at.getTime() - 3600000)])).rows[0];
  if (z.object({ count: z.number().int().nonnegative() }).parse(row).count >= 20) throw new EntryFault("RATE_LIMITED", 429);
}
