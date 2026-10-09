import { z } from "zod";
import { PaymentPolicyDetailSchema, UpdatePaymentPolicySchema } from "../../contracts/payment-policy.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "../entries/http.ts";

const rowSchema = z.object({ revision: z.number().int(), payment_policy: z.unknown(), payment_routing: z.unknown(), draft_enabled: z.boolean(), payment_enabled: z.boolean() });
async function authorize(db: SqlConnection, actor: string, id: string, mutate: boolean) {
  const row = (await db.query("SELECT permission FROM gyca_payment_permissions WHERE user_id=$1 AND competition_id=$2 FOR SHARE", [actor, id])).rows[0];
  const scope = z.object({ permission: z.enum(["viewer", "operator"]) }).safeParse(row);
  if (!scope.success || (mutate && scope.data.permission !== "operator")) throw new EntryFault("FORBIDDEN", 403);
}
export function createPaymentPolicyHandlers(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const identifier = z.string().min(1).max(128);
  return {
    get: (request: Request, competitionId: string) => run(request, false, 200, actor => deps.database.transaction(async db => {
      const id = parseRequest(identifier, competitionId); await authorize(db, actor, id, false);
      const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1", [id])).rows[0];
      if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
      const row = rowSchema.parse(raw);
      return PaymentPolicyDetailSchema.parse({ competitionId: id, revision: row.revision, policy: row.payment_policy, routing: row.payment_routing });
    })),
    update: (request: Request, competitionId: string) => run(request, true, 200, async actor => {
      const id = parseRequest(identifier, competitionId);
      const input = parseRequest(UpdatePaymentPolicySchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor, id, true);
        const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
        const row = rowSchema.parse(raw);
        if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.draft_enabled || row.payment_enabled || (await db.query("SELECT id FROM gyca_entries WHERE competition_id=$1 LIMIT 1", [id])).rows.length > 0)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const revision = row.revision + 1;
        await db.query("UPDATE gyca_competitions SET payment_policy=$2::jsonb,payment_routing=$3::jsonb,revision=$4 WHERE id=$1",
          [id, JSON.stringify(input.policy), JSON.stringify(input.routing), revision]);
        await db.query("INSERT INTO gyca_payment_policy_changes VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6)",
          [id, revision, actor, JSON.stringify(input.policy), JSON.stringify(input.routing), deps.now()]);
        return PaymentPolicyDetailSchema.parse({ competitionId: id, revision, policy: input.policy, routing: input.routing });
      });
    }),
  };
}
