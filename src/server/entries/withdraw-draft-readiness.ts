import { z } from "zod";
import { DraftWithdrawalReadinessSchema } from "../../contracts/draft-withdrawal.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, parseRequest } from "./http.ts";

export function createWithdrawDraftReadinessHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, entryId: string) => run(request, false, 200, async owner => {
    const id = parseRequest(z.uuid(), entryId);
    const raw = (await deps.database.query(`SELECT e.revision,(e.status='draft' AND e.submitted_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM gyca_submissions s WHERE s.entry_id=e.id)
      AND NOT EXISTS(SELECT 1 FROM gyca_orders o WHERE o.entry_id=e.id)) AS eligible
      FROM gyca_entries e WHERE e.id=$1 AND e.owner_id=$2`, [id, owner])).rows[0];
    if (!raw) throw new EntryFault("NOT_FOUND", 404);
    const row = z.object({ revision: z.number().int(), eligible: z.boolean() }).parse(raw);
    return DraftWithdrawalReadinessSchema.parse({ entryId: id, revision: row.revision,
      allowedActions: row.eligible ? ["withdraw_draft"] : [], blockingReasons: row.eligible ? [] : ["ENTRY_LOCKED"] });
  });
}
