import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createSubmissionDownloadHandler } from '../src/server/uploads/submission-download.ts';

test('only owner can obtain submitted immutable asset download; origin and missing storage fail closed', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('owner'),('other');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('one','one')");
    const id = randomUUID(); const assetId = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'owner','one')", [id]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,'asset','hash','book_pdf','book.pdf',3,'application/pdf',10,'stored-key','submitted-version',now(),'ready')`, [assetId, id]);
    await db.query("INSERT INTO gyca_submissions VALUES($1,'key','hash',now(),$2,'{}')", [id, JSON.stringify({ assets: [
      { id: assetId, object_key: 'stored-key', object_version: 'submitted-version', state: 'ready' },
    ] })]);
    const calls = [];
    const storage = { signDownload: async input => { calls.push(input); return { url: 'https://storage.test/file', expiresAt: '2026-09-16T00:01:00Z' }; } };
    const make = backend => createSubmissionDownloadHandler({ database: db, storage: backend, now: () => new Date(), origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const get = (actor, asset = assetId, origin = 'https://gyca.test', backend = storage) => make(backend)(new Request('https://gyca.test/api', {
      method: 'POST', headers: { origin, ...(actor ? { 'x-user': actor } : {}) },
    }), id, asset);
    assert.equal((await get(null)).status, 401);
    assert.equal((await get('other')).status, 404);
    assert.equal((await get('owner', randomUUID())).status, 404);
    assert.equal((await get('owner', 'bad')).status, 422);
    assert.equal((await get('owner', assetId, 'https://evil.test')).status, 403);
    assert.equal((await get('owner', assetId, 'https://gyca.test', null)).status, 503);
    assert.equal(calls.length, 0);
    const response = await get('owner'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(calls, [{ key: 'stored-key', version: 'submitted-version' }]);
    await db.query('UPDATE gyca_assets SET removed_at=now() WHERE id=$1', [assetId]);
    assert.equal((await get('owner')).status, 409);
  } finally { await db.close(); }
});
