// DEV-ONLY: a received entry with a complete frozen submission snapshot so the
// admin entry detail renders with real data. Guarded: localhost + GYCA_DEV_SEED=1.
import pg from "pg";
import { randomUUID, createHash } from "node:crypto";

if (process.env.GYCA_DEV_SEED !== "1") { console.error("Set GYCA_DEV_SEED=1"); process.exit(1); }
const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || process.env.NODE_ENV === "production") {
  console.error("Refusing: local dev DB only."); process.exit(1);
}
const OWNER = "YOmCGxGkuIsLOp5YZ5JGEuz8tDWzkgfc"; // participant@gyca.test
const COMP = "leipzig-2027";
const at = "2027-01-05T00:00:00.000Z";
const entry = randomUUID();
const asset = randomUUID();
const documents = ["participation_rules", "privacy", "work_license"].map((kind) => ({
  kind, version: "2027.1", locale: "en", title: `${kind} title`, text: `Full ${kind} text (dev sample).`,
  textSha256: createHash("sha256").update(kind).digest("hex"), actorId: OWNER, acceptedAt: at,
}));
const snapshot = {
  participant: { name: "Frozen Name", nameEn: "Frozen Name", dateOfBirth: "2011-05-01", residenceCountry: "KR" },
  work: { title: "동결 작품", englishTitle: "Frozen Work", category: "artbook" },
  ageGroup: "youth", consents: documents,
  assets: [{ id: asset, purpose: "book_pdf", display_name: "frozen.pdf", declared_type: "application/pdf",
    size_bytes: 1024, page_count: 24, state: "ready", object_key: "private/object/key", object_version: "private-version" }],
};
const c = new pg.Client(url);
await c.connect();
try {
  await c.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,revision,participant,work,guardian,created_at,submitted_at,received_at,receipt_number)
    VALUES($1,$2,$3,'received',2,$4::jsonb,$5::jsonb,$6::jsonb,$7,$7,$7,$8)`,
    [entry, OWNER, COMP, JSON.stringify({ name: "Current Name" }), JSON.stringify({ englishTitle: "Current Work" }),
     JSON.stringify({ email: "guardian@example.test" }), at, `GYCA-${entry.slice(0, 8)}`]);
  await c.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
    VALUES($1,'submit','hash',$2,$3::jsonb,'{}'::jsonb)`, [entry, at, JSON.stringify(snapshot)]);
  await c.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
    VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','fixture','DEV-MID',false,'succeeded',$4,$3,$3)`,
    [randomUUID(), entry, at, `paid-${entry}`]);
  console.log(JSON.stringify({ competitionId: COMP, entryId: entry }));
} finally { await c.end(); }
