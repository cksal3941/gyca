import { randomUUID } from "node:crypto";
import { z } from "zod";
import { OrderIdSchema } from "../../contracts/index.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { PaymentProvider } from "./provider.ts";
import type { createPaymentService } from "./service.ts";

const MAX_ATTEMPTS = 12;
const LEASE_MS = 120000;
const jobSchema = z.object({ order_id: OrderIdSchema, owner_id: z.string(), attempts: z.number().int(),
  terminal: z.boolean() });
type Outcome = "idle" | "completed" | "retry_scheduled" | "stalled" | "superseded";

async function escalate(db: SqlConnection, orderId: string, at: Date) {
  await db.query(`INSERT INTO gyca_payment_outbox(key,kind,entry_id,order_id,created_at)
    SELECT $1,'payment_review',entry_id,id,$3 FROM gyca_orders WHERE id=$2 ON CONFLICT DO NOTHING`,
    [`payment_recovery_stalled:${orderId}`, orderId, at]);
}

export function createPaymentRecovery(database: EntryDatabase,
  provider: Pick<PaymentProvider, "id" | "merchantAccount" | "liveMode"> | null,
  service: Pick<ReturnType<typeof createPaymentService>, "reconcile">, now: () => Date) {
  return {
    async runOnce(): Promise<{ readonly outcome: Outcome }> {
      if (provider === null) throw new EntryFault("PAYMENT_UNAVAILABLE", 503);
      const claimed = await database.transaction(async (db) => {
        const at = now();
        // Discover committed orders as well as earlier orders whose request process crashed.
        await db.query(`INSERT INTO gyca_payment_recovery(order_id,due_at,updated_at)
          SELECT o.id,$4,$4 FROM gyca_orders o WHERE o.provider=$1 AND o.merchant_account=$2 AND o.live_mode=$3
            AND o.state<>'succeeded' AND NOT o.needs_review
            AND (EXISTS(SELECT 1 FROM gyca_payment_confirmations c WHERE c.order_id=o.id)
              OR EXISTS(SELECT 1 FROM gyca_payment_events v WHERE v.order_id=o.id))
            AND NOT EXISTS(SELECT 1 FROM gyca_payment_recovery j WHERE j.order_id=o.id)
          ORDER BY o.created_at,o.id LIMIT 50 ON CONFLICT DO NOTHING`, [provider.id, provider.merchantAccount, provider.liveMode, at]);
        const row = (await db.query(`SELECT j.order_id,j.attempts,e.owner_id,
            (o.state='succeeded' OR o.needs_review) AS terminal
          FROM gyca_payment_recovery j JOIN gyca_orders o ON o.id=j.order_id JOIN gyca_entries e ON e.id=o.entry_id
          WHERE o.provider=$1 AND o.merchant_account=$2 AND o.live_mode=$3
            AND ((j.state='pending' AND j.due_at<=$4) OR (j.state='running' AND j.lease_until<=$4))
          ORDER BY j.due_at,j.order_id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,
          [provider.id, provider.merchantAccount, provider.liveMode, at])).rows[0];
        if (row === undefined) return { kind: "idle" } as const;
        const job = jobSchema.parse(row);
        if (job.terminal || job.attempts >= MAX_ATTEMPTS) {
          const state = job.terminal ? "completed" : "stalled";
          await db.query("UPDATE gyca_payment_recovery SET state=$2,lease_token=NULL,lease_until=NULL,updated_at=$3 WHERE order_id=$1", [job.order_id, state, at]);
          if (state === "stalled") await escalate(db, job.order_id, at);
          return { kind: state } as const;
        }
        const token = randomUUID();
        await db.query(`UPDATE gyca_payment_recovery SET state='running',attempts=attempts+1,
          lease_token=$2,lease_until=$3,updated_at=$4 WHERE order_id=$1`, [job.order_id, token, new Date(at.getTime() + LEASE_MS), at]);
        return { kind: "claimed", job, token } as const;
      });
      if (claimed.kind !== "claimed") return { outcome: claimed.kind };
      // External lookup never holds queue locks and cannot initiate or confirm a charge.
      let complete = false;
      let code: string | null = null;
      try {
        const result = await service.reconcile(claimed.job.owner_id, claimed.job.order_id);
        complete = result.state === "succeeded" || result.needsReview;
      } catch (error) {
        code = error instanceof EntryFault ? error.code : "INTERNAL_ERROR";
      }
      const rateLimited = code === "RATE_LIMITED";
      const attempt = claimed.job.attempts + (rateLimited ? 0 : 1);
      const state = complete ? "completed" : attempt >= MAX_ATTEMPTS ? "stalled" : "pending";
      const delay = rateLimited ? 10000 : Math.min(900000, 30000 * 2 ** Math.min(attempt - 1, 10));
      return database.transaction(async (db) => {
        const at = now();
        const updated = await db.query(`UPDATE gyca_payment_recovery SET state=$3,attempts=$4,due_at=$5,
          lease_token=NULL,lease_until=NULL,last_error_code=$6,updated_at=$7
          WHERE order_id=$1 AND state='running' AND lease_token=$2 RETURNING order_id`,
          [claimed.job.order_id, claimed.token, state, attempt, new Date(at.getTime() + delay), code, at]);
        if (updated.rows.length === 0) return { outcome: "superseded" };
        if (state === "stalled") await escalate(db, claimed.job.order_id, at);
        return { outcome: state === "pending" ? "retry_scheduled" : state };
      });
    },
  };
}
