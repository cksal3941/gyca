import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('payment policies require scoped operator permission and never activate checkout', async () => {
  const { createPaymentPolicyHandlers } = await import('../src/server/competitions/payment-policy-admin.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('operator'),('viewer'),('outsider')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('test','test'),('other','other');
      INSERT INTO gyca_payment_permissions VALUES('operator','test','operator'),('viewer','test','viewer')`);
    const api = createPaymentPolicyHandlers({ database: db, now: () => new Date(), origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const req = (body, actor = 'operator', origin = 'https://gyca.test') => new Request('https://gyca.test/api', { method: body ? 'PUT' : 'GET',
      headers: { ...(actor ? { 'x-user': actor } : {}), origin, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const input = { revision: 1, policy: { version: 'test-v1', approvalBasis: 'provider_paid_at' }, routing: { version: 'test-v1', routes: [
      { id: 'toss-test', enabled: true, provider: 'tosspayments', merchantAccount: 'fixture-mid', liveMode: false, countries: ['KR'], currency: 'EUR',
        approvalReference: 'fixture-only', label: { en: 'Test card', ko: '테스트 카드' }, refundNotice: { en: 'Test notice', ko: '테스트 문구' } },
    ] } };
    assert.equal((await api.get(req(undefined, null), 'test')).status, 401);
    assert.equal((await api.get(req(undefined, 'outsider'), 'test')).status, 403);
    assert.equal((await api.get(req(), 'other')).status, 403);
    assert.equal((await api.get(req(undefined, 'viewer'), 'test')).status, 200);
    assert.equal((await api.update(req(input, 'viewer'), 'test')).status, 403);
    assert.equal((await api.update(req(input, 'operator', 'https://evil.test'), 'test')).status, 403);
    assert.equal((await api.update(req({ ...input, secretKey: 'not-accepted' }), 'test')).status, 422);
    const saved = await api.update(req(input), 'test'); assert.equal(saved.status, 200);
    assert.equal((await saved.json()).data.revision, 2);
    assert.deepEqual((await (await api.get(req(), 'test')).json()).data.routing, input.routing);
    assert.equal((await api.update(req(input), 'test')).status, 409);
    await assert.rejects(db.exec('DELETE FROM gyca_payment_policy_changes'), /immutable/i);
    assert.equal((await db.query('SELECT payment_enabled FROM gyca_competitions WHERE id=$1', ['test'])).rows[0].payment_enabled, false);
    await db.exec(`CREATE FUNCTION fail_policy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_policy_audit BEFORE INSERT ON gyca_payment_policy_changes FOR EACH ROW EXECUTE FUNCTION fail_policy_audit()`);
    assert.equal((await api.update(req({ ...input, revision: 2 }), 'test')).status, 500);
    assert.equal((await (await api.get(req(), 'test')).json()).data.revision, 2);
    await db.exec('DROP TRIGGER fail_policy_audit ON gyca_payment_policy_changes');
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'outsider','test')", [randomUUID()]);
    assert.equal((await api.update(req({ ...input, revision: 2 }), 'test')).status, 409);
  } finally { await db.close(); }
});
