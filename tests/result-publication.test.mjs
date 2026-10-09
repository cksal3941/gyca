import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createResultAdminHandlers } from '../src/server/entries/result-admin.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { createAssetRetentionWorker } from '../src/server/uploads/retention-worker.ts';

test('publishes only a complete result set and atomically schedules result-specific retention', async () => {
  const db = new PGlite(); const at = new Date('2026-09-18T00:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('admin'),('owner-a'),('owner-b');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    const policy = { enabled: true, version: 'retention-v2', withdrawnDraftAssets: { deleteAfterDays: 7 },
      unselectedSubmissionAssets: { deleteAfterDays: 30 }, selectedSubmissionAssets: { deleteAfterDays: 365 },
      consentEvidence: { retainDays: 365 }, paymentEvidence: { retainDays: 1825 } };
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,closes_at,phase,retention_policy)
      VALUES('one','one',true,$1,'judging',$2)`, [new Date(at.getTime() - 1000), policy]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    const selected = randomUUID(); const rejected = randomUUID(); const selectedAsset = randomUUID(); const rejectedAsset = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number)
      VALUES($1,'owner-a','one','received',$3,$3,'GYCA-A'),($2,'owner-b','one','received',$3,$3,'GYCA-B')`, [selected, rejected, at]);
    for (const [entry, asset] of [[selected, selectedAsset], [rejected, rejectedAsset]]) {
      await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,$2,'h',$3,'{}','{}')", [entry, entry, at]);
      await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
        VALUES($1,$2,$3,'h','book_pdf','book.pdf',3,'application/pdf',10,$4,$5,$6,'ready')`,
        [asset, entry, asset, `quarantine/${entry}/${asset}`, `version-${asset}`, at]);
      await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
        VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','test',false,'succeeded',$4,$3,$3)`, [randomUUID(), entry, at, `paid-${entry}`]);
    }
    const handlers = createResultAdminHandlers({ database: db, now: () => at, origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-user') });
    const put = (entry, body, actor = 'admin', origin = 'https://gyca.test') => handlers.updateReview(new Request('https://gyca.test/api', {
      method: 'PUT', headers: { origin, 'content-type': 'application/json', 'x-user': actor }, body: JSON.stringify(body),
    }), 'one', entry);
    const publish = revision => handlers.publish(new Request('https://gyca.test/api', { method: 'POST',
      headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-user': 'admin' },
      body: JSON.stringify({ competitionRevision: revision }) }), 'one');
    assert.equal((await put(selected, { expectedRevision: 0, reviewStatus: 'completed', decision: 'finalist' }, 'owner-a')).status, 403);
    assert.equal((await put(selected, { expectedRevision: 0, reviewStatus: 'completed', decision: null })).status, 422);
    assert.equal((await put(selected, { expectedRevision: 0, reviewStatus: 'completed', decision: 'finalist' }, 'admin', 'https://evil.test')).status, 403);
    assert.equal((await put(selected, { expectedRevision: 0, reviewStatus: 'completed', decision: 'finalist' })).status, 200);
    const repository = createEntryRepository(db, () => at);
    const before = await repository.get('owner-a', selected);
    assert.equal(before.reviewStatus, 'completed'); assert.equal(before.publishedResult, null);
    assert.equal((await publish(1)).status, 409);
    assert.equal((await put(rejected, { expectedRevision: 0, reviewStatus: 'completed', decision: 'not_selected' })).status, 200);
    await db.exec(`CREATE FUNCTION fail_result_retention() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END; $$;
      CREATE TRIGGER fail_result_retention BEFORE INSERT ON gyca_asset_deletion_jobs FOR EACH ROW EXECUTE FUNCTION fail_result_retention();`);
    assert.equal((await publish(1)).status, 500);
    assert.equal((await db.query("SELECT phase,revision FROM gyca_competitions WHERE id='one'")).rows[0].phase, 'judging');
    assert.equal((await db.query('SELECT * FROM gyca_result_publication_batches')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gyca_entry_result_publications')).rows.length, 0);
    await db.exec('DROP TRIGGER fail_result_retention ON gyca_asset_deletion_jobs');
    const response = await publish(1); assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.deepEqual(result, { competitionId: 'one', sourceRevision: 1, resultingRevision: 2, entryCount: 2, publishedAt: at.toISOString() });
    assert.deepEqual((await (await publish(1)).json()).data, result);
    assert.equal((await put(selected, { expectedRevision: 1, reviewStatus: 'under_review', decision: null })).status, 409);
    const after = await repository.get('owner-a', selected);
    assert.equal(after.reviewStatus, 'completed'); assert.equal(after.publishedResult, 'finalist');
    const jobs = (await db.query('SELECT entry_id,reason,due_at,policy_version FROM gyca_asset_deletion_jobs ORDER BY entry_id')).rows;
    assert.equal(jobs.length, 2); assert.equal(jobs.every(job => job.policy_version === 'retention-v2'), true);
    const selectedJob = jobs.find(job => job.entry_id === selected); const rejectedJob = jobs.find(job => job.entry_id === rejected);
    assert.equal(selectedJob.reason, 'selected_submission'); assert.equal(selectedJob.due_at.toISOString(), '2027-09-18T00:00:00.000Z');
    assert.equal(rejectedJob.reason, 'unselected_submission'); assert.equal(rejectedJob.due_at.toISOString(), '2026-10-18T00:00:00.000Z');
    const deletions = [];
    const worker = createAssetRetentionWorker(db, { signCreate: async () => assert.fail(), readImmutable: async () => null,
      deleteImmutable: async input => deletions.push(input) }, () => new Date('2026-10-18T00:00:00Z'));
    assert.deepEqual(await worker.runOnce(), { outcome: 'completed' });
    assert.deepEqual(deletions, [{ key: `quarantine/${rejected}/${rejectedAsset}`, version: `version-${rejectedAsset}` }]);
    assert.notEqual((await db.query('SELECT removed_at FROM gyca_assets WHERE id=$1', [rejectedAsset])).rows[0].removed_at, null);
    assert.equal((await db.query('SELECT removed_at FROM gyca_assets WHERE id=$1', [selectedAsset])).rows[0].removed_at, null);
    assert.equal((await db.query("SELECT phase,revision FROM gyca_competitions WHERE id='one'")).rows[0].phase, 'result');
    await assert.rejects(db.query('DELETE FROM gyca_entry_result_publications'), /immutable/);
    await assert.rejects(db.query('DELETE FROM gyca_entry_review_changes'), /immutable/);
    await assert.rejects(db.query('UPDATE gyca_result_publication_batches SET entry_count=1'), /immutable/);
  } finally { await db.close(); }
});
