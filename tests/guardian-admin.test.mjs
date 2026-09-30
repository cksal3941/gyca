import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

test('organizer reads bounded guardian evidence without granting verification', async () => {
  const { createGuardianAdminHandler } = await import('../src/server/notifications/guardian-admin.ts');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('owner')`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','011_competition_admin','013_guardian_consent','020_guardian_verifications'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_competitions(id,slug) VALUES('contest','contest')");
    const entry = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'owner','contest')", [entry]);
    const handler = createGuardianAdminHandler({ database: db, now: () => new Date(), origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-test-user') });
    const get = (actor = 'editor', query = '', id = entry, competition = 'contest') => handler(new Request(`https://gyca.test/api${query}`, {
      headers: actor === null ? {} : { 'x-test-user': actor },
    }), competition, id);
    assert.equal((await get(null)).status, 401);
    assert.equal((await get('owner')).status, 403);
    assert.equal((await get('editor', '', randomUUID())).status, 404);
    assert.equal((await get('editor', '', entry, 'other')).status, 404);
    assert.equal((await get('editor', '?limit=51')).status, 422);
    assert.equal((await get('editor', '?cursor=bad')).status, 422);
    assert.deepEqual((await (await get()).json()).data.items, []);
    const ids = [randomUUID(), randomUUID()].sort();
    for (const id of ids) await db.query(`INSERT INTO gyca_guardian_requests VALUES($1,$2,$3,1,'policy','en','parent@example.org','[]','2026-09-01Z','2026-09-02Z')`, [id, entry, `secret-${id}`]);
    await db.query("INSERT INTO gyca_guardian_consents VALUES($1,'Parent','2026-09-01T01:00Z')", [ids[0]]);
    await db.query(`INSERT INTO gyca_guardian_verifications
      (request_id,entry_id,entry_revision,policy_token,actor_id,evidence_reference,verified_at)
      VALUES($1,$2,1,'policy','editor','OPS-2026-0001','2026-09-01T02:00Z')`, [ids[0], entry]);
    const response = await get('editor', '?limit=1');
    assert.match(response.headers.get('cache-control'), /no-store/);
    const first = (await response.json()).data;
    assert.equal(first.items[0].requestId, ids[0]);
    assert.equal(first.items[0].guardianName, 'Parent');
    assert.equal(first.items[0].acceptedAt, '2026-09-01T01:00:00.000Z');
    assert.deepEqual(first.items[0].verification, { verifiedAt: '2026-09-01T02:00:00.000Z', evidenceReference: 'OPS-2026-0001' });
    assert.equal(first.verificationStatus, 'not_verified');
    assert.deepEqual(first.allowedActions, []);
    assert.equal(first.nextCursor, ids[0]);
    assert.doesNotMatch(JSON.stringify(first), /secret-|token_hash|recipient|parent@example/);
    const second = (await (await get('editor', `?limit=1&cursor=${first.nextCursor}`)).json()).data;
    assert.equal(second.items[0].requestId, ids[1]);
    assert.equal(second.items[0].acceptedAt, null);
    assert.equal(second.nextCursor, null);
    assert.equal((await db.query('SELECT status FROM gyca_entries WHERE id=$1', [entry])).rows[0].status, 'draft');
    await assert.rejects(db.query('DELETE FROM gyca_guardian_verifications'), /immutable/);
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'");
    assert.equal((await get()).status, 403);
  } finally { await db.close(); }
});
