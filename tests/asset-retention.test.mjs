import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createWithdrawDraftHandler } from '../src/server/entries/withdraw-draft.ts';
import { createAssetRetentionWorker } from '../src/server/uploads/retention-worker.ts';

async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner');`);
  for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
  const policy = { enabled: true, version: 'retention-v1', withdrawnDraftAssets: { deleteAfterDays: 7 },
    unselectedSubmissionAssets: { deleteAfterDays: 30 }, selectedSubmissionAssets: { deleteAfterDays: 365 },
    consentEvidence: { retainDays: 365 }, paymentEvidence: { retainDays: 1825 } };
  await db.query("INSERT INTO gyca_competitions(id,slug,retention_policy) VALUES('one','one',$1)", [policy]);
  return db;
}

test('withdrawal queues only known immutable versions and worker deletes the exact version when due', async () => {
  const db = await fixture(); let clock = new Date('2026-09-18T00:00:00Z');
  try {
    const entry = randomUUID(); const versioned = randomUUID(); const unknown = randomUUID();
    const key = `quarantine/${entry}/${versioned}`;
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'owner','one')", [entry]);
    const insert = `INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,$3,'h','book_pdf','book.pdf',3,'application/pdf',10,$4,$5,$6,'ready')`;
    await db.query(insert, [versioned, entry, 'known', key, 's3-version-7', clock]);
    await db.query(insert, [unknown, entry, 'unknown', `quarantine/${entry}/${unknown}`, null, clock]);
    await assert.rejects(db.query(`INSERT INTO gyca_asset_deletion_jobs(asset_id,entry_id,competition_id,object_key,object_version,reason,policy_version,due_at,created_at)
      VALUES($1,$2,'one',$3,'s3-version-7','withdrawn_draft','retention-v1',$4,$5)`,
      [versioned, entry, key, new Date(clock.getTime() + 7 * 86400000), clock]), /not an exact withdrawn version/);
    const handler = createWithdrawDraftHandler({ database: db, now: () => clock, origin: 'https://gyca.test', getUserId: async () => 'owner' });
    const response = await handler(new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test', 'content-type': 'application/json' }, body: '{"revision":1}' }), entry);
    assert.equal(response.status, 200);
    const jobs = (await db.query('SELECT * FROM gyca_asset_deletion_jobs')).rows;
    assert.equal(jobs.length, 1); assert.equal(jobs[0].asset_id, versioned);
    assert.equal(jobs[0].object_key, key); assert.equal(jobs[0].object_version, 's3-version-7');
    assert.equal(jobs[0].policy_version, 'retention-v1');
    assert.equal(jobs[0].due_at.toISOString(), '2026-09-25T00:00:00.000Z');
    const calls = [];
    const worker = createAssetRetentionWorker(db, { signCreate: async () => assert.fail(), readImmutable: async () => null,
      deleteImmutable: async input => calls.push(input) }, () => clock);
    assert.deepEqual(await worker.runOnce(), { outcome: 'idle' }); assert.equal(calls.length, 0);
    clock = new Date('2026-09-25T00:00:00Z');
    assert.deepEqual(await worker.runOnce(), { outcome: 'completed' });
    assert.deepEqual(calls, [{ key, version: 's3-version-7' }]);
    const completed = (await db.query('SELECT state,attempts,completed_at FROM gyca_asset_deletion_jobs')).rows[0];
    assert.equal(completed.state, 'completed'); assert.equal(completed.attempts, 1); assert.equal(completed.completed_at.toISOString(), clock.toISOString());
    const event = (await db.query('SELECT attempt,outcome,error_code FROM gyca_asset_deletion_events')).rows[0];
    assert.deepEqual(event, { attempt: 1, outcome: 'completed', error_code: null });
    await assert.rejects(db.query("UPDATE gyca_asset_deletion_jobs SET object_version='other'"), /immutable/);
    await assert.rejects(db.query('DELETE FROM gyca_asset_deletion_events'), /immutable/);
  } finally { await db.close(); }
});

test('retention worker records redacted failure and schedules a bounded retry', async () => {
  const db = await fixture(); const clock = new Date('2026-09-18T00:00:00Z');
  try {
    const entry = randomUUID(); const asset = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id,status) VALUES($1,'owner','one','withdrawn')", [entry]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,'known','h','book_pdf','book.pdf',3,'application/pdf',10,$3,'v1',$4,'ready')`, [asset, entry, `quarantine/${entry}/${asset}`, clock]);
    await db.query('UPDATE gyca_assets SET removed_at=$2 WHERE id=$1', [asset, clock]);
    await db.query(`INSERT INTO gyca_asset_deletion_jobs(asset_id,entry_id,competition_id,object_key,object_version,reason,policy_version,due_at,created_at)
      VALUES($1,$2,'one',$3,'v1','withdrawn_draft','retention-v1',$4,$4)`, [asset, entry, `quarantine/${entry}/${asset}`, clock]);
    const worker = createAssetRetentionWorker(db, { signCreate: async () => assert.fail(), readImmutable: async () => null,
      deleteImmutable: async () => { throw new Error('private AWS response'); } }, () => clock);
    assert.deepEqual(await worker.runOnce(), { outcome: 'retry_scheduled' });
    const job = (await db.query('SELECT state,attempts,last_error_code,due_at FROM gyca_asset_deletion_jobs')).rows[0];
    assert.equal(job.state, 'pending'); assert.equal(job.attempts, 1); assert.equal(job.last_error_code, 'INTERNAL_ERROR');
    assert.equal(job.due_at.toISOString(), '2026-09-18T00:00:30.000Z');
    assert.doesNotMatch(JSON.stringify((await db.query('SELECT * FROM gyca_asset_deletion_events')).rows), /private|AWS/);
  } finally { await db.close(); }
});
