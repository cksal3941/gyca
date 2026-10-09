import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createGuardianConsent } from '../src/server/notifications/guardian-consent.ts';

test('guardian mail limit counts all entries for one owner and releases at the hour boundary', async () => {
  const { checkGuardianMailLimit } = await import('../src/server/notifications/guardian-rate-limit.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('alice'),('bob')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('test','test')");
    const ids = [randomUUID(), randomUUID()];
    const at = new Date('2026-09-16T00:00:00Z');
    for (const id of ids) await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'alice','test')", [id]);
    const check = (owner, now = at) => db.transaction(tx => checkGuardianMailLimit(tx, owner, () => now));
    for (let i = 0; i < 19; i++) await db.query(`INSERT INTO gyca_guardian_requests VALUES($1,$2,$3,1,'policy','en','parent@example.org','[]',$4,$5)`,
      [randomUUID(), ids[i % 2], `token-${i}`, at, new Date(at.getTime() + 86400000)]);
    await check('alice');
    await db.query(`INSERT INTO gyca_guardian_requests VALUES($1,$2,'last-token',1,'policy','en','parent@example.org','[]',$3,$4)`,
      [randomUUID(), ids[1], at, new Date(at.getTime() + 86400000)]);
    await assert.rejects(check('alice'), { code: 'RATE_LIMITED', status: 429 });
    const service = createGuardianConsent(db, { origin: 'https://gyca.test', now: () => at,
      mailer: { from: 'guardian@example.org', send: async () => assert.fail('quota rejection must not send mail') } });
    await assert.rejects(service.request('alice', { entryId: ids[0], revision: 1, locale: 'en' }), { code: 'RATE_LIMITED' });
    await check('bob');
    await assert.rejects(check('alice', new Date(at.getTime() + 3599999)), { code: 'RATE_LIMITED' });
    await check('alice', new Date(at.getTime() + 3600000));
    assert.equal((await db.query('SELECT count(*)::int AS count FROM gyca_guardian_requests')).rows[0].count, 20);
  } finally { await db.close(); }
});
