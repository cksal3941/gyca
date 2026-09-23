import { z } from "zod";
import { AdminAccessSchema } from "../../contracts/admin-access.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";

const querySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(128).optional(),
});
const rowSchema = z.object({
  organizer: z.boolean(),
  payment_permissions: z.array(z.object({ competitionId: z.string(), permission: z.enum(["viewer", "operator"]) })),
});

export function createAdminAccessHandler(deps: {
  readonly database: EntryDatabase;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined;
  readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request) => run(request, false, 200, async actor => {
    const params = new URL(request.url).searchParams;
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) throw new EntryFault("VALIDATION_FAILED", 422);
    const { limit, cursor } = parseRequest(querySchema, Object.fromEntries(params));
    const result = await deps.database.query(`
      SELECT EXISTS(SELECT 1 FROM gyca_competition_editors WHERE user_id=$1) AS organizer,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('competitionId',competition_id,'permission',permission) ORDER BY competition_id)
          FROM (SELECT competition_id,permission FROM gyca_payment_permissions
            WHERE user_id=$1 AND ($2::text IS NULL OR competition_id>$2)
            ORDER BY competition_id LIMIT $3) AS scoped), '[]'::jsonb) AS payment_permissions`,
    [actor, cursor ?? null, limit + 1]);
    const row = rowSchema.parse(result.rows[0]);
    return AdminAccessSchema.parse({ organizer: row.organizer,
      paymentPermissions: row.payment_permissions.slice(0, limit),
      nextCursor: row.payment_permissions.length > limit ? row.payment_permissions.at(limit - 1)?.competitionId ?? null : null,
    });
  });
}
