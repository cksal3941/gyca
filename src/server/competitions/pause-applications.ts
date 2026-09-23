import { z } from "zod";
import { PauseApplicationsSchema, PausedApplicationsSchema } from "../../contracts/application-pause.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";

export function createPauseApplicationsHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, true, 200, async actor => {
    const id = parseRequest(z.string().min(1).max(128), competitionId);
    const input = parseRequest(PauseApplicationsSchema, await jsonBody(request));
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      const raw = (await db.query("SELECT revision,draft_enabled,payment_enabled FROM gyca_competitions WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ revision: z.number().int(), draft_enabled: z.boolean(), payment_enabled: z.boolean() }).parse(raw);
      if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
      const revision = row.revision + 1;
      await db.query("UPDATE gyca_competitions SET draft_enabled=false,revision=$2 WHERE id=$1", [id, revision]);
      await db.query("INSERT INTO gyca_application_pauses VALUES($1,$2,$3,$4,$5,$6)", [id, revision, actor, input.reason, row.draft_enabled, deps.now()]);
      return PausedApplicationsSchema.parse({ competitionId: id, revision, draftEnabled: false, paymentEnabled: row.payment_enabled });
    });
  });
}
