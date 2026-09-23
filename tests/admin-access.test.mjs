import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('own admin access is scoped, paginated, fresh and never grants participant permissions', async () => {
  const { createAdminAccessHandler } = await import('../src/server/admin/access.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('staff'),('other'),('participant');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('a','a'),('b','b'),('secret','secret');
      INSERT INTO gyca_competition_editors VALUES('staff');
      INSERT INTO gyca_payment_permissions VALUES('staff','a','viewer'),('staff','b','operator'),('other','secret','operator');`);
    const handler = createAdminAccessHandler({ database: db, now: () => new Date(), origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-user') });
    const get = (actor, query = '') => handler(new Request(`https://gyca.test/api/v1/admin/access${query}`, { headers: actor ? { 'x-user': actor } : {} }));
    assert.equal((await get(null)).status, 401);
    const participant = await get('participant');
    assert.equal(participant.status, 200);
    assert.deepEqual((await participant.json()).data, { organizer: false, paymentPermissions: [], nextCursor: null });
    const first = await get('staff', '?limit=1');
    assert.match(first.headers.get('cache-control'), /no-store/);
    assert.deepEqual((await first.json()).data, { organizer: true, paymentPermissions: [{ competitionId: 'a', permission: 'viewer' }], nextCursor: 'a' });
    assert.deepEqual((await (await get('staff', '?limit=1&cursor=a')).json()).data,
      { organizer: true, paymentPermissions: [{ competitionId: 'b', permission: 'operator' }], nextCursor: null });
    for (const query of ['?limit=0','?limit=51','?limit=1.5','?cursor=','?cursor=' + 'a'.repeat(129),'?userId=other','?limit=1&limit=2']) {
      assert.equal((await get('staff', query)).status, 422, query);
    }
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='staff'; DELETE FROM gyca_payment_permissions WHERE user_id='staff'");
    assert.deepEqual((await (await get('staff')).json()).data, { organizer: false, paymentPermissions: [], nextCursor: null });
    assert.deepEqual((await (await get('other')).json()).data,
      { organizer: false, paymentPermissions: [{ competitionId: 'secret', permission: 'operator' }], nextCursor: null });
  } finally { await db.close(); }
});
