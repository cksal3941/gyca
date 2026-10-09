import { z } from "zod";
import { PolicyHistoryPageSchema } from "../../contracts/policy-history.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ revision: z.number().int(), actor_id: z.string(), created_at: z.date(), policy: z.unknown(), routing: z.unknown() });
export function createPolicyHistoryHandler(deps: {
  readonly kind: "submission" | "payment"; readonly database: EntryDatabase;
  readonly getUserId: (request: Request) => Promise<string | null>; readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, false, 200, actor => {
    const id = parseRequest(z.string().min(1).max(128), competitionId);
    const params = new URL(request.url).searchParams;
    const cursor = parseRequest(z.coerce.number().int().positive().max(2147483647).nullable(), params.get("cursor"));
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    return deps.database.transaction(async db => {
      const permission = deps.kind === "submission"
        ? await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])
        : await db.query("SELECT user_id FROM gyca_payment_permissions WHERE user_id=$1 AND competition_id=$2 AND permission IN ('viewer','operator') FOR SHARE", [actor, id]);
      if (permission.rows.length === 0) throw new EntryFault("FORBIDDEN", 403);
      if ((await db.query("SELECT id FROM gyca_competitions WHERE id=$1", [id])).rows.length === 0) throw new EntryFault("NOT_FOUND", 404);
      const sql = deps.kind === "submission"
        ? "SELECT revision,actor_id,created_at,policy,NULL::jsonb AS routing FROM gyca_submission_policy_changes WHERE competition_id=$1 AND ($2::integer IS NULL OR revision<$2) ORDER BY revision DESC LIMIT $3"
        : "SELECT revision,actor_id,created_at,policy,routing FROM gyca_payment_policy_changes WHERE competition_id=$1 AND ($2::integer IS NULL OR revision<$2) ORDER BY revision DESC LIMIT $3";
      const rows = (await db.query(sql, [id, cursor, limit + 1])).rows.map(row => rowSchema.parse(row));
      return PolicyHistoryPageSchema.parse({ items: rows.slice(0, limit).map(row => ({
        kind: deps.kind, revision: row.revision, actorId: row.actor_id, createdAt: row.created_at.toISOString(), policy: row.policy,
        ...(deps.kind === "payment" ? { routing: row.routing } : {}),
      })), nextCursor: rows.length > limit ? rows.at(limit - 1)?.revision ?? null : null });
    });
  });
}
