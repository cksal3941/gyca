import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('organizer configures consent policy before entries exist with immutable audit', async () => {
  const { createSubmissionPolicyHandlers } = await import('../src/server/competitions/submission-policy-admin.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_competitions(id,slug) VALUES('test','test')");
    const handlers = createSubmissionPolicyHandlers({ database: db, now: () => new Date(), origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-user') });
    const req = (body, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
      method: body === undefined ? 'GET' : 'PUT', headers: { ...(actor ? { 'x-user': actor } : {}), origin, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const policy = { enabled: true, version: 'fixture-v1', guardianAgeBasis: 'submission_date_in_competition_timezone', guardianAgeByCountry: { KR: 14 },
      documents: ['participation_rules','privacy','work_license'].map(kind => ({ kind, locale: 'en', version: 'test', title: kind, text: 'Fixture only' })) };
    assert.equal((await handlers.get(req(undefined, null), 'test')).status, 401);
    assert.equal((await handlers.get(req(undefined, 'participant'), 'test')).status, 403);
    assert.equal((await handlers.get(req(), 'missing')).status, 404);
    assert.equal((await (await handlers.get(req(), 'test')).json()).data.policy, null);
    assert.equal((await handlers.update(req({ revision: 1, policy }, 'editor', 'https://evil.test'), 'test')).status, 403);
    assert.equal((await handlers.update(req({ revision: 1, policy: { ...policy, extra: true } }), 'test')).status, 422);
    const saved = await handlers.update(req({ revision: 1, policy }), 'test');
    assert.equal(saved.status, 200); assert.match(saved.headers.get('cache-control'), /no-store/);
    assert.equal((await saved.json()).data.revision, 2);
    assert.deepEqual((await (await handlers.get(req(), 'test')).json()).data.policy, policy);
    assert.equal((await handlers.update(req({ revision: 1, policy }), 'test')).status, 409);
    await assert.rejects(db.exec('DELETE FROM gyca_submission_policy_changes'), /immutable/i);
    await db.exec(`CREATE FUNCTION fail_policy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_policy_audit BEFORE INSERT ON gyca_submission_policy_changes FOR EACH ROW EXECUTE FUNCTION fail_policy_audit()`);
    assert.equal((await handlers.update(req({ revision: 2, policy: { ...policy, version: 'changed' } }), 'test')).status, 500);
    assert.equal((await (await handlers.get(req(), 'test')).json()).data.revision, 2);
    assert.equal((await (await handlers.get(req(), 'test')).json()).data.policy.version, 'fixture-v1');
    await db.exec('DROP TRIGGER fail_policy_audit ON gyca_submission_policy_changes');
    const row = (await db.query('SELECT draft_enabled,payment_enabled,published FROM gyca_competitions')).rows[0];
    assert.deepEqual(row, { draft_enabled: false, payment_enabled: false, published: false });
    await db.exec("UPDATE gyca_competitions SET draft_enabled=true");
    assert.equal((await handlers.update(req({ revision: 2, policy }), 'test')).status, 409);
    await db.exec("UPDATE gyca_competitions SET draft_enabled=false");
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'participant','test')", [randomUUID()]);
    assert.equal((await handlers.update(req({ revision: 2, policy }), 'test')).status, 409);
  } finally { await db.close(); }
});
