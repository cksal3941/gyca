// DEV-ONLY isolated fixture: an after-deadline approved payment needing review,
// so the operator can exercise accept-late-payment against the LIVE API.
// Guarded: localhost DB + NODE_ENV!=production + GYCA_DEV_SEED=1.
import pg from "pg";
import { randomUUID } from "node:crypto";

if (process.env.GYCA_DEV_SEED !== "1") { console.error("Set GYCA_DEV_SEED=1"); process.exit(1); }
const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || process.env.NODE_ENV === "production") {
  console.error("Refusing: local dev DB only."); process.exit(1);
}
const OWNER = "YOmCGxGkuIsLOp5YZ5JGEuz8tDWzkgfc"; // participant@gyca.test
const COMP = "leipzig-2027";
const id = randomUUID();
const closesAt = "2027-01-01T00:00:00.000Z";
const paidAt = "2027-01-02T00:00:00.000Z"; // after the deadline → APPROVED_AFTER_DEADLINE
const c = new pg.Client(url);
await c.connect();
try {
  await c.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,participant,work,guardian)
    VALUES($1,$2,$3,'submitted',$4,'{"name":"Dev Fixture"}'::jsonb,'{}'::jsonb,'{}'::jsonb)`, [id, OWNER, COMP, paidAt]);
  await c.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
    VALUES($1,$2,'hash',$3,'{}'::jsonb,'{}'::jsonb)`, [id, `key-${id}`, paidAt]);
  await c.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,
    approval_basis,provider,merchant_account,live_mode,needs_review,state,provider_payment_id,paid_at,created_at)
    VALUES($1,$1,7000,'EUR',$2,'v1','provider_paid_at','fixture','DEV-MID',false,true,'succeeded',$3,$4,$2)`,
    [id, closesAt, `payment-${id}`, paidAt]);
  await c.query(`INSERT INTO gyca_payment_recovery(order_id,state,attempts,due_at,updated_at)
    VALUES($1,'completed',1,$2,$2)`, [id, paidAt]);
  const evidence = { eventId: `late-${id}`, paymentId: `payment-${id}`, orderId: id, merchantAccount: "DEV-MID",
    liveMode: false, state: "succeeded", amountMinor: 7000, currency: "EUR", paidAt };
  await c.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
    VALUES('fixture','DEV-MID',false,$2,'hash',$1,$3::jsonb,$4,'review')`, [id, evidence.eventId, JSON.stringify(evidence), paidAt]);
  console.log(JSON.stringify({ orderId: id, entryId: id }));
} finally { await c.end(); }
