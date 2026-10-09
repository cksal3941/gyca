import { z } from "zod";
import { ConsentEvidenceSchema } from "../../contracts/consent-evidence.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, parseRequest } from "./http.ts";

export function createConsentEvidenceHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string, entryId: string) => run(request, false, 200, actor => {
    const competition = parseRequest(z.string().min(1).max(128), competitionId);
    const entry = parseRequest(z.uuid(), entryId);
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      const raw = (await db.query(`SELECT s.submitted_at,s.snapshot->'consents' AS consents
        FROM gyca_submissions s JOIN gyca_entries e ON e.id=s.entry_id
        WHERE s.entry_id=$1 AND e.competition_id=$2`, [entry, competition])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ submitted_at: z.date(), consents: z.unknown() }).parse(raw);
      return ConsentEvidenceSchema.parse({ entryId: entry, submittedAt: row.submitted_at.toISOString(), consents: row.consents });
    });
  });
}
