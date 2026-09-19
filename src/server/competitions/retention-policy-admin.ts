import { z } from "zod";
import { RetentionPolicyDetailSchema, UpdateRetentionPolicySchema } from "../../contracts/retention-policy.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";

const rowSchema = z.object({ revision: z.number().int().positive(), retention_policy: z.unknown(),
  draft_enabled: z.boolean(), payment_enabled: z.boolean() });
async function authorize(db: SqlConnection, actor: string) {
  if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
    throw new EntryFault("FORBIDDEN", 403);
}

export function createRetentionPolicyHandlers(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const idSchema = z.string().min(1).max(128);
  return {
    get: (request: Request, competitionId: string) => run(request, false, 200, actor => deps.database.transaction(async db => {
      const id = parseRequest(idSchema, competitionId); await authorize(db, actor);
      const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = rowSchema.parse(raw);
      return RetentionPolicyDetailSchema.parse({ competitionId: id, revision: row.revision, policy: row.retention_policy });
    })),
    update: (request: Request, competitionId: string) => run(request, true, 200, async actor => {
      const id = parseRequest(idSchema, competitionId);
      const input = parseRequest(UpdateRetentionPolicySchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor);
        const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
        const row = rowSchema.parse(raw);
        if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.draft_enabled || row.payment_enabled
          || (await db.query("SELECT id FROM gyca_entries WHERE competition_id=$1 LIMIT 1", [id])).rows.length > 0)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const revision = row.revision + 1;
        await db.query("UPDATE gyca_competitions SET retention_policy=$2::jsonb,revision=$3 WHERE id=$1",
          [id, JSON.stringify(input.policy), revision]);
        await db.query("INSERT INTO gyca_retention_policy_changes VALUES($1,$2,$3,$4::jsonb,$5)",
          [id, revision, actor, JSON.stringify(input.policy), deps.now()]);
        return RetentionPolicyDetailSchema.parse({ competitionId: id, revision, policy: input.policy });
      });
    }),
  };
}
