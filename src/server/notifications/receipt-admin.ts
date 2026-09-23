import { z } from "zod";
import { ReceiptDeliveryPageSchema } from "../../contracts/receipt-admin.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import { EntryFault } from "../entries/errors.ts";

const rowSchema = z.object({ key: z.string(), entry_id: z.string(), order_id: z.string(), entry_status: z.string(),
  email_state: z.enum(["pending", "running", "sent", "stalled"]), email_attempts: z.number().int(),
  email_due_at: z.date(), delivered_at: z.date().nullable(), email_verified: z.boolean() });

export function createReceiptAdminHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, false, 200, actor => {
    const id = parseRequest(z.string().min(1).max(128), competitionId);
    const params = new URL(request.url).searchParams;
    const cursor = parseRequest(z.string().min(1).max(512).nullable(), params.get("cursor"));
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      if ((await db.query("SELECT id FROM gyca_competitions WHERE id=$1", [id])).rows.length === 0)
        throw new EntryFault("NOT_FOUND", 404);
      const rows = (await db.query(`SELECT b.key,b.entry_id,b.order_id,e.status AS entry_status,b.email_state,b.email_attempts,
        b.email_due_at,b.delivered_at,COALESCE(u."emailVerified",false) AS email_verified
        FROM gyca_payment_outbox b JOIN gyca_entries e ON e.id=b.entry_id JOIN "user" u ON u.id=e.owner_id
        WHERE e.competition_id=$1 AND b.kind='entry_received' AND ($2::text IS NULL OR b.key>$2)
        ORDER BY b.key LIMIT $3`, [id, cursor, limit + 1])).rows.map(row => rowSchema.parse(row));
      return ReceiptDeliveryPageSchema.parse({ items: rows.slice(0, limit).map(row => ({
        entryId: row.entry_id, orderId: row.order_id, entryStatus: row.entry_status,
        state: row.email_state === "sent" ? "provider_accepted" : row.email_state,
        attempts: row.email_attempts, nextAttemptAt: row.email_state === "pending" ? row.email_due_at.toISOString() : null,
        providerAcceptedAt: row.delivered_at?.toISOString() ?? null, emailVerified: row.email_verified, allowedActions: [],
      })), nextCursor: rows.length > limit ? rows.at(limit - 1)?.key ?? null : null });
    });
  });
}
