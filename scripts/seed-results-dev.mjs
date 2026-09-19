// DEV-ONLY isolated fixture: a competition past its deadline in the judging
// phase with one received entry, so the operator can exercise review decision ->
// result publication -> certificate issue against the LIVE API.
// Guarded: localhost DB + NODE_ENV!=production + GYCA_DEV_SEED=1.
import pg from "pg";
import { randomUUID } from "node:crypto";

if (process.env.GYCA_DEV_SEED !== "1") { console.error("Set GYCA_DEV_SEED=1"); process.exit(1); }
const url = process.env.DATABASE_URL || "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || process.env.NODE_ENV === "production") {
  console.error("Refusing: local dev DB only."); process.exit(1);
}
const OPERATOR = "U9ny4y47ltaAe40baL6tAvy1WCXZG7vS";
const OWNER = "YOmCGxGkuIsLOp5YZ5JGEuz8tDWzkgfc";
const COMP = "stage4-results-dev";
const closesAt = "2026-09-10T00:00:00.000Z"; // already past (server now ~2026-09-20)
const at = "2026-09-05T00:00:00.000Z";
const policy = { enabled: true, version: "retention-v2", withdrawnDraftAssets: { deleteAfterDays: 7 },
  unselectedSubmissionAssets: { deleteAfterDays: 30 }, selectedSubmissionAssets: { deleteAfterDays: 365 },
  consentEvidence: { retainDays: 365 }, paymentEvidence: { retainDays: 1825 } };
const entry = randomUUID();
const asset = randomUUID();
const c = new pg.Client(url);
await c.connect();
try {
  await c.query("DELETE FROM gyca_competition_editors WHERE user_id=$1", [OPERATOR]).catch(() => {});
  await c.query(`INSERT INTO gyca_competitions(id,slug,published,draft_enabled,opens_at,closes_at,phase,public_content,payment_enabled,payment_closes_at,revision,retention_policy)
    VALUES($1,$1,true,false,$2,$3,'judging',$4::jsonb,false,$3,1,$5::jsonb)
    ON CONFLICT(id) DO UPDATE SET phase='judging',closes_at=$3,retention_policy=$5::jsonb`,
    [COMP, at, closesAt, JSON.stringify({ title: { en: "Stage 4 Results Dev", ko: "4단계 결과 검증" } }), JSON.stringify(policy)]);
  await c.query("INSERT INTO gyca_competition_editors(user_id) VALUES($1) ON CONFLICT DO NOTHING", [OPERATOR]);
  await c.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number,participant,work,guardian)
    VALUES($1,$2,$3,'received',$4,$4,$5,'{"name":"Results Fixture"}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
    [entry, OWNER, COMP, at, `GYCA-${entry.slice(0, 8)}`]);
  await c.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
    VALUES($1,$2,'h',$3,'{}'::jsonb,'{}'::jsonb)`, [entry, entry, at]);
  await c.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
    VALUES($1,$2,$3,'h','book_pdf','book.pdf',3,'application/pdf',10,$4,$5,$6,'ready')`,
    [asset, entry, asset, `quarantine/${entry}/${asset}`, `version-${asset}`, at]);
  await c.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
    VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','fixture','DEV-MID',false,'succeeded',$4,$3,$3)`,
    [randomUUID(), entry, at, `paid-${entry}`]);
  const rev = (await c.query("SELECT revision FROM gyca_competitions WHERE id=$1", [COMP])).rows[0].revision;
  console.log(JSON.stringify({ competitionId: COMP, entryId: entry, revision: rev }));
} finally { await c.end(); }
