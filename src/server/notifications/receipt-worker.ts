import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { ReceiptEmailSchema } from "./resend.ts";
import type { ReceiptMailer } from "./resend.ts";

const jobSchema = z.object({ key: z.string(), email_attempts: z.number().int(), email_first_attempt_at: z.date().nullable(),
  email_payload: z.unknown(), email: z.email(), receipt_number: z.string(), received_at: z.date() });
export function createReceiptWorker(database: EntryDatabase, mailer: ReceiptMailer | null, now: () => Date) {
  return { async runOnce() {
    if (mailer === null) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
    const claimed = await database.transaction(async db => {
      const at = now();
      const raw = (await db.query(`SELECT b.key,b.email_attempts,b.email_first_attempt_at,b.email_payload,u.email,e.receipt_number,e.received_at
        FROM gyca_payment_outbox b JOIN gyca_entries e ON e.id=b.entry_id JOIN "user" u ON u.id=e.owner_id
        JOIN gyca_orders o ON o.id=b.order_id AND o.entry_id=e.id
        WHERE b.kind='entry_received' AND b.delivered_at IS NULL AND e.status='received' AND o.state='succeeded'
          AND e.receipt_number IS NOT NULL AND e.received_at IS NOT NULL AND u."emailVerified"=true
          AND ((b.email_state='pending' AND b.email_due_at<=$1) OR (b.email_state='running' AND b.email_lease_until<=$1))
        ORDER BY b.email_due_at,b.key LIMIT 1 FOR UPDATE OF b SKIP LOCKED`, [at])).rows[0];
      if (raw === undefined) return { kind: "idle" } as const;
      const job = jobSchema.parse(raw);
      if (job.email_attempts >= 12 || (job.email_first_attempt_at !== null && at.getTime() - job.email_first_attempt_at.getTime() >= 23 * 3600000)) {
        await db.query("UPDATE gyca_payment_outbox SET email_state='stalled',email_lease=NULL,email_lease_until=NULL WHERE key=$1", [job.key]);
        return { kind: "stalled" } as const;
      }
      const payload = ReceiptEmailSchema.parse(job.email_payload ?? { from: mailer.from, to: [job.email],
        subject: "GYCA — Entry received / 접수 완료",
        text: `Your entry has been received. / 접수가 완료되었습니다.\nReceipt / 접수번호: ${job.receipt_number}\nReceived at (UTC): ${job.received_at.toISOString()}\nYou can check your entry in My GYCA. / 마이페이지에서 접수 내역을 확인하세요.` });
      const token = randomUUID();
      await db.query(`UPDATE gyca_payment_outbox SET email_state='running',email_attempts=email_attempts+1,email_lease=$2,email_lease_until=$3,
        email_first_attempt_at=COALESCE(email_first_attempt_at,$4),email_payload=COALESCE(email_payload,$5::jsonb) WHERE key=$1`,
        [job.key, token, new Date(at.getTime() + 120000), at, JSON.stringify(payload)]);
      return { kind: "claimed", job, token, payload } as const;
    });
    if (claimed.kind !== "claimed") return { outcome: claimed.kind };
    let providerId: string | null = null;
    try { providerId = await mailer.send(claimed.payload, `gyca-receipt-${createHash("sha256").update(claimed.job.key).digest("hex")}`); }
    catch { /* Retry the frozen payload with the same key inside the provider retention window. */ }
    const at = now();
    const state = providerId !== null ? "sent" : claimed.job.email_attempts + 1 >= 12 ? "stalled" : "pending";
    const result = await database.query(`UPDATE gyca_payment_outbox SET email_state=$3,email_provider_id=$4,
      delivered_at=CASE WHEN $4::text IS NOT NULL THEN $5 ELSE delivered_at END,email_due_at=$6,email_lease=NULL,email_lease_until=NULL
      WHERE key=$1 AND email_state='running' AND email_lease=$2 RETURNING key`,
      [claimed.job.key, claimed.token, state, providerId, at, new Date(at.getTime() + Math.min(900000, 30000 * 2 ** claimed.job.email_attempts))]);
    return { outcome: result.rows.length === 0 ? "superseded" : state === "pending" ? "retry_scheduled" : state };
  } };
}
