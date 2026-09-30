// DEV-ONLY: archive the placeholder editorial content created by
// seed-notices-dev.mjs (all slugs "seed-*") so the public /notices page no
// longer shows demo entries. Event-sourced schema — rows cannot be hard
// deleted, so this mirrors the app's archive transition
// (createEditorialService.transition -> "archived" in src/server/content/
// editorial.ts): bump revision, append a change row (reason "archived"),
// then flip status to archived. Idempotent (already-archived rows are
// skipped). Guarded: localhost DB + NODE_ENV!=production + GYCA_DEV_SEED=1.
import pg from "pg";
import { readFileSync } from "node:fs";

if (process.env.GYCA_DEV_SEED !== "1") { console.error("Set GYCA_DEV_SEED=1"); process.exit(1); }
const url =
  process.env.DATABASE_URL ||
  (readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.*)/)?.[1] ?? "").trim();
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || process.env.NODE_ENV === "production") {
  console.error("Refusing: local dev DB only."); process.exit(1);
}

const c = new pg.Client(url);
await c.connect();
let archived = 0, skipped = 0;
try {
  await c.query("BEGIN");
  const rows = (await c.query(
    "SELECT id,slug,status,revision,content,created_by FROM gyca_editorial_content WHERE slug LIKE 'seed-%' FOR UPDATE",
  )).rows;
  for (const row of rows) {
    if (row.status === "archived") { skipped++; continue; }
    const at = new Date();
    const revision = row.revision + 1;
    const snapshot = JSON.stringify(row.content); // content column is jsonb -> object
    // 1) history evidence (projection trigger requires a matching change row)
    await c.query(
      `INSERT INTO gyca_editorial_content_changes(content_id,revision,status,snapshot,actor_id,reason,created_at)
       VALUES($1,$2,'archived',$3::jsonb,$4,'archived',$5)`,
      [row.id, revision, snapshot, row.created_by, at],
    );
    // 2) flip the projection (published_at left untouched, matching transition())
    await c.query(
      `UPDATE gyca_editorial_content SET status='archived',revision=$2,updated_at=$3 WHERE id=$1`,
      [row.id, revision, at],
    );
    archived++;
  }
  await c.query("COMMIT");
  console.log(JSON.stringify({ matched: rows.length, archived, skipped }));
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
