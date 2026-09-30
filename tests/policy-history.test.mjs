import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('policy history respects distinct permissions and paginates frozen revisions', async () => {
  const { createPolicyHistoryHandler } = await import('../src/server/competitions/policy-history.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('viewer');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('test','test'),('other','other');
      INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_payment_permissions VALUES('viewer','test','viewer')`);
    const make = kind => createPolicyHistoryHandler({ database: db, kind, now: () => new Date(), origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const get = (kind, actor, query = '', id = 'test') => make(kind)(new Request(`https://gyca.test/api${query}`, { headers: actor ? { 'x-user': actor } : {} }), id);
    assert.equal((await get('submission', null)).status, 401);
    assert.equal((await get('submission', 'viewer')).status, 403);
    assert.equal((await get('payment', 'editor')).status, 403);
    assert.equal((await get('payment', 'viewer', '', 'other')).status, 403);
    assert.equal((await get('submission', 'editor', '?cursor=bad')).status, 422);
    assert.equal((await get('submission', 'editor', '?cursor=2147483648')).status, 422);
    assert.equal((await get('payment', 'viewer', '?limit=51')).status, 422);
    assert.deepEqual((await (await get('payment', 'viewer')).json()).data.items, []);
    const policy = { enabled: true, version: 'v1', guardianAgeBasis: 'submission_date_in_competition_timezone', guardianAgeByCountry: { KR: 14 },
      documents: ['participation_rules','privacy','work_license'].map(kind => ({ kind, locale: 'en', version: 'v1', title: kind, text: 'Historical fixture' })) };
    for (const revision of [2, 4]) await db.query('INSERT INTO gyca_submission_policy_changes VALUES($1,$2,$3,$4,now())', ['test', revision, 'editor', JSON.stringify(policy)]);
    const first = await get('submission', 'editor', '?limit=1'); assert.match(first.headers.get('cache-control'), /no-store/);
    const page = (await first.json()).data; assert.equal(page.items[0].revision, 4); assert.equal(page.nextCursor, 4);
    assert.deepEqual(page.items[0].policy, policy);
    const second = (await (await get('submission', 'editor', '?limit=1&cursor=4')).json()).data;
    assert.equal(second.items[0].revision, 2); assert.equal(second.nextCursor, null);
    await db.query('INSERT INTO gyca_payment_policy_changes VALUES($1,3,$2,$3,$4,now())', ['test','viewer', JSON.stringify({ version: 'v1', approvalBasis: 'provider_paid_at' }), JSON.stringify({ version: 'v1', routes: [] })]);
    assert.equal((await (await get('payment', 'viewer')).json()).data.items[0].kind, 'payment');
    await db.exec("DELETE FROM gyca_payment_permissions WHERE user_id='viewer'");
    assert.equal((await get('payment', 'viewer')).status, 403);
  } finally { await db.close(); }
});
