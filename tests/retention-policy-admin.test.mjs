import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createRetentionPolicyHandlers } from '../src/server/competitions/retention-policy-admin.ts';

test('retention policy is explicit, audited and frozen before applications exist', async () => {
  const db = new PGlite();
  const at = new Date('2026-09-18T00:00:00Z');
  const policy = { enabled: true, version: '2027.1',
    withdrawnDraftAssets: { deleteAfterDays: 7 }, unselectedSubmissionAssets: { deleteAfterDays: 30 },
    selectedSubmissionAssets: { deleteAfterDays: 730 }, consentEvidence: { retainDays: 1095 },
    paymentEvidence: { retainDays: 1825 } };
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competition_editors VALUES('editor');
      INSERT INTO gyca_competitions(id,slug) VALUES('contest','contest')`);
    const handlers = createRetentionPolicyHandlers({ database: db, now: () => at, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-user') });
    const get = (actor = 'editor', id = 'contest') => handlers.get(new Request('https://gyca.test/policy', {
      headers: actor ? { 'x-user': actor } : {},
    }), id);
    const put = (body, actor = 'editor', origin = 'https://gyca.test', id = 'contest') => handlers.update(
      new Request('https://gyca.test/policy', { method: 'PUT', headers: { origin, 'content-type': 'application/json',
        ...(actor ? { 'x-user': actor } : {}) }, body: JSON.stringify(body) }), id);

    assert.equal((await get(null)).status, 401);
    assert.equal((await get('participant')).status, 403);
    assert.equal((await get('editor', 'missing')).status, 404);
    assert.deepEqual((await (await get()).json()).data, { competitionId: 'contest', revision: 1, policy: null });
    assert.equal((await put({ revision: 1, policy }, 'participant')).status, 403);
    assert.equal((await put({ revision: 1, policy }, 'editor', 'https://evil.test')).status, 403);
    assert.equal((await put({ revision: 1, policy: { ...policy, secret: true } })).status, 422);
    assert.equal((await put({ revision: 1, policy: { ...policy, paymentEvidence: { retainDays: 0 } } })).status, 422);

    await db.exec(`CREATE FUNCTION fail_retention_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_retention_audit BEFORE INSERT ON gyca_retention_policy_changes FOR EACH ROW EXECUTE FUNCTION fail_retention_audit()`);
    assert.equal((await put({ revision: 1, policy })).status, 500);
    assert.equal((await db.query('SELECT retention_policy FROM gyca_competitions')).rows[0].retention_policy, null);
    await db.exec('DROP TRIGGER fail_retention_audit ON gyca_retention_policy_changes');

    const saved = await put({ revision: 1, policy });
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).data, { competitionId: 'contest', revision: 2, policy });
    assert.equal((await put({ revision: 1, policy })).status, 409);
    const audit = (await db.query('SELECT actor_id,policy FROM gyca_retention_policy_changes')).rows[0];
    assert.equal(audit.actor_id, 'editor'); assert.deepEqual(audit.policy, policy);
    await assert.rejects(db.query('DELETE FROM gyca_retention_policy_changes'), /immutable/);

    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'participant','contest')", [randomUUID()]);
    assert.equal((await put({ revision: 2, policy: { ...policy, version: '2027.2' } })).status, 409);
  } finally {
    await db.close();
  }
});
