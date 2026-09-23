import { z } from "zod";
import { ResumeApplicationsSchema, ResumedApplicationsSchema } from "../../contracts/application-pause.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";
import { CompetitionRowSchema, projectCompetition } from "./policy.ts";

const rowSchema = CompetitionRowSchema.extend({ revision: z.number().int().positive() });

export function createResumeApplicationsHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, true, 200, async actor => {
    const id = parseRequest(z.string().min(1).max(128), competitionId);
    const input = parseRequest(ResumeApplicationsSchema, await jsonBody(request));
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR UPDATE", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = rowSchema.parse(raw);
      if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
      if (row.draft_enabled) throw new EntryFault("ENTRY_LOCKED", 409);
      const pauseRaw = (await db.query(`SELECT revision,previously_enabled FROM gyca_application_pauses
        WHERE competition_id=$1 ORDER BY revision DESC LIMIT 1 FOR SHARE`, [id])).rows[0];
      if (pauseRaw === undefined) throw new EntryFault("ENTRY_LOCKED", 409);
      const pause = z.object({ revision: z.number().int().positive(), previously_enabled: z.boolean() }).parse(pauseRaw);
      if (!pause.previously_enabled) throw new EntryFault("ENTRY_LOCKED", 409);
      let projected;
      try { projected = projectCompetition({ ...row, draft_enabled: true }, deps.now()); }
      catch { throw new EntryFault("POLICY_NOT_CONFIGURED", 503); }
      if (projected === null || !projected.readiness.application) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      if (projected.status === "archived") throw new EntryFault("COMPETITION_ARCHIVED", 409);
      if (!["upcoming", "open"].includes(projected.status)) throw new EntryFault("DEADLINE_PASSED", 409);
      const revision = row.revision + 1;
      await db.query("UPDATE gyca_competitions SET draft_enabled=true,revision=$2 WHERE id=$1", [id, revision]);
      await db.query("INSERT INTO gyca_application_resumes VALUES($1,$2,$3,$4,$5,$6)",
        [id, revision, actor, input.reason, pause.revision, deps.now()]);
      return ResumedApplicationsSchema.parse({ competitionId: id, revision, draftEnabled: true, paymentEnabled: row.payment_enabled });
    });
  });
}
