import { z } from "zod";
import { PaymentHealthSchema } from "../../contracts/payment-health.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";

export function createPaymentHealthHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, false, 200, actor => {
    const id = parseRequest(z.string().min(1).max(128), competitionId);
    return deps.database.transaction(async db => {
      if ((await db.query(`SELECT user_id FROM gyca_payment_permissions
        WHERE user_id=$1 AND competition_id=$2 AND permission IN ('viewer','operator') FOR SHARE`, [actor, id])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      const at = deps.now();
      const raw = (await db.query(`SELECT
        jsonb_build_object('total',count(*),'pending',count(*) FILTER(WHERE o.state='pending'),
          'succeeded',count(*) FILTER(WHERE o.state='succeeded'),'failed',count(*) FILTER(WHERE o.state='failed'),
          'cancelled',count(*) FILTER(WHERE o.state='cancelled'),'expired',count(*) FILTER(WHERE o.state='expired'),
          'needsReview',count(*) FILTER(WHERE o.needs_review)) AS orders,
        jsonb_build_object('pending',count(*) FILTER(WHERE j.state='pending'),'running',count(*) FILTER(WHERE j.state='running'),
          'completed',count(*) FILTER(WHERE j.state='completed'),'stalled',count(*) FILTER(WHERE j.state='stalled'),
          'due',count(*) FILTER(WHERE j.state='pending' AND j.due_at<=$2),
          'expiredLeases',count(*) FILTER(WHERE j.state='running' AND j.lease_until<=$2)) AS recovery,
        min(j.due_at) FILTER(WHERE j.state='pending' AND j.due_at<=$2) AS oldest_due_at
        FROM gyca_orders o JOIN gyca_entries e ON e.id=o.entry_id
        LEFT JOIN gyca_payment_recovery j ON j.order_id=o.id WHERE e.competition_id=$1`, [id, at])).rows[0];
      const row = z.object({ orders: z.unknown(), recovery: PaymentHealthSchema.unwrap().shape.recovery.unwrap().omit({ oldestDueAt: true }),
        oldest_due_at: z.date().nullable() }).parse(raw);
      return PaymentHealthSchema.parse({ competitionId: id, measuredAt: at.toISOString(), orders: row.orders,
        recovery: { ...row.recovery, oldestDueAt: row.oldest_due_at?.toISOString() ?? null } });
    });
  });
}
