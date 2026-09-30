import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createWithdrawDraftHandler } from '../src/server/entries/withdraw-draft.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { createWithdrawDraftReadinessHandler } from '../src/server/entries/withdraw-draft-readiness.ts';

test('withdraws only owned unsubmitted drafts, fences assets, replays and remains readable', async () => {
  const db = new PGlite(); const at = new Date('2026-09-17T00:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('one','one')");
    const id = randomUUID(); const submitted = randomUUID(); const asset = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'owner','one'),($2,'owner','one')", [id, submitted]);
    await db.query("INSERT INTO gyca_submissions VALUES($1,'k','h',$2,'{}','{}')", [submitted, at]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,expires_at,state,validation_token)
      VALUES($1,$2,'k','h','book_pdf','book.pdf',100,'application/pdf',100,'key',$3,'validating',$4)`, [asset, id, at, randomUUID()]);
    const handler = createWithdrawDraftHandler({ database: db, now: () => at, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const post = (actor, entry = id, revision = 1, origin = 'https://gyca.test') => handler(new Request('https://gyca.test/api', {
      method: 'POST', headers: { origin, 'content-type': 'application/json', ...(actor ? { 'x-user': actor } : {}) }, body: JSON.stringify({ revision }),
    }), entry);
    assert.equal((await post(null)).status, 401); assert.equal((await post('other')).status, 404);
    assert.equal((await post('owner', id, 1, 'https://evil.test')).status, 403);
    assert.equal((await post('owner', id, 9)).status, 409);
    assert.equal((await post('owner', submitted)).status, 409);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,created_at)
      VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','test',false,$3)`, [randomUUID(), submitted, at]);
    assert.equal((await post('owner', submitted)).status, 409);
    const readiness = createWithdrawDraftReadinessHandler({ database: db, now: () => at, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const get = (actor, entry = id) => readiness(new Request('https://gyca.test/api', { headers: actor ? { 'x-user': actor } : {} }), entry);
    assert.equal((await get(null)).status, 401); assert.equal((await get('other')).status, 404);
    assert.deepEqual((await (await get('owner')).json()).data.allowedActions, ['withdraw_draft']);
    assert.deepEqual((await (await get('owner', submitted)).json()).data.allowedActions, []);
    await db.exec(`CREATE FUNCTION fail_asset_removal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END; $$;
      CREATE TRIGGER fail_removal BEFORE UPDATE ON gyca_assets FOR EACH ROW EXECUTE FUNCTION fail_asset_removal();`);
    assert.equal((await post('owner')).status, 500);
    assert.deepEqual((await db.query('SELECT status,revision FROM gyca_entries WHERE id=$1', [id])).rows[0], { status: 'draft', revision: 1 });
    assert.equal((await db.query('SELECT removed_at FROM gyca_assets WHERE id=$1', [asset])).rows[0].removed_at, null);
    await db.exec('DROP TRIGGER fail_removal ON gyca_assets');
    await db.exec('CREATE TRIGGER fail_audit BEFORE INSERT ON gyca_draft_withdrawals FOR EACH ROW EXECUTE FUNCTION fail_asset_removal()');
    assert.equal((await post('owner')).status, 500);
    assert.deepEqual((await db.query('SELECT status,revision FROM gyca_entries WHERE id=$1', [id])).rows[0], { status: 'draft', revision: 1 });
    assert.equal((await db.query('SELECT removed_at FROM gyca_assets WHERE id=$1', [asset])).rows[0].removed_at, null);
    assert.equal((await db.query('SELECT * FROM gyca_draft_withdrawals')).rows.length, 0);
    await db.exec('DROP TRIGGER fail_audit ON gyca_draft_withdrawals');
    const response = await post('owner'); assert.equal(response.status, 200);
    const result = (await response.json()).data;
    assert.deepEqual(result, { entryId: id, revision: 2, entryStatus: 'withdrawn', withdrawnAt: at.toISOString() });
    assert.deepEqual((await (await post('owner')).json()).data, result);
    const audit = (await db.query('SELECT * FROM gyca_draft_withdrawals')).rows;
    assert.equal(audit.length, 1); assert.equal(audit[0].actor_id, 'owner');
    assert.equal(audit[0].previous_revision, 1); assert.equal(audit[0].resulting_revision, 2);
    await assert.rejects(db.query('UPDATE gyca_draft_withdrawals SET withdrawn_at=now()'), /immutable/);
    await assert.rejects(db.query('DELETE FROM gyca_draft_withdrawals'), /immutable/);
    await db.query('UPDATE gyca_entries SET updated_at=$2 WHERE id=$1', [id, new Date(at.getTime() + 1000)]);
    assert.deepEqual((await (await post('owner')).json()).data, result);
    const locked = await get('owner'); assert.equal(locked.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await locked.json()).data, { entryId: id, revision: 2, allowedActions: [], blockingReasons: ['ENTRY_LOCKED'] });
    const saved = (await db.query('SELECT removed_at,validation_token FROM gyca_assets WHERE id=$1', [asset])).rows[0];
    assert.equal(saved.removed_at.toISOString(), at.toISOString()); assert.equal(saved.validation_token, null);
    const repo = createEntryRepository(db, () => at);
    const detail = await repo.get('owner', id);
    assert.equal(detail.entryStatus, 'withdrawn'); assert.deepEqual(detail.allowedActions, []);
    assert.deepEqual(detail.blockingReasons, ['ENTRY_LOCKED']);
    assert.equal((await repo.list('owner', null, 20)).items.length, 2);
    await assert.rejects(repo.update('owner', id, { revision: 2, work: { title: 'Cannot edit' } }), { code: 'ENTRY_LOCKED' });
  } finally { await db.close(); }
});
