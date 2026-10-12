import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations, platformMigrationNames } from '../scripts/lib/platform-migrations.mjs';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);

test('Given a competition, an organizer can upload a pamphlet that becomes the public poster', async t => {
  assert.ok(platformMigrationNames.includes('041_competition_posters'));
  const { createPosterService } = await import('../src/server/content/competition-poster.ts');
  const { createPosterHandlers } = await import('../src/server/content/competition-poster-http.ts');
  const { createPresentationService } = await import('../src/server/content/competition-presentation.ts');
  const { createPresentationHandlers } = await import('../src/server/content/competition-presentation-http.ts');
  const db = new PGlite(); const now = () => new Date('2026-10-12T00:00:00Z');
  const bi = value => ({ en: value, ko: value }); const id = randomUUID(); const hidden = randomUUID();
  try {
    await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES (\'editor\'),(\'participant\')');
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const content = { title: bi('Contest'), fee: { currency: 'EUR', amountMinor: 7000 }, timezone: 'Europe/Berlin',
      keyDates: [], formSpec: null, exhibition: null, guidelines: null };
    for (const [compId, slug, visible] of [[id, 'viyba-2026', true], [hidden, 'hidden-2026', false]]) await db.query(`INSERT INTO gyca_competitions
      (id,slug,published,public_content,opens_at,closes_at) VALUES($1,$2,$3,$4::jsonb,'2026-09-01','2026-10-01')`, [compId, slug, visible, JSON.stringify(content)]);
    const deps = { now, origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-user') };
    const handlers = createPosterHandlers({ ...deps, service: createPosterService(db, now) });
    const cards = createPresentationHandlers({ ...deps, service: createPresentationService(db, now) });
    const put = (body, type = 'image/png', actor = 'editor') => new Request('https://gyca.test/api', { method: 'PUT',
      headers: { 'content-type': type, origin: 'https://gyca.test', 'x-user': actor }, body });
    const del = (actor = 'editor') => new Request('https://gyca.test/api', { method: 'DELETE', headers: { origin: 'https://gyca.test', 'x-user': actor } });
    const get = (actor = 'editor') => new Request('https://gyca.test/api', { headers: { 'x-user': actor } });
    const sha = createHash('sha256').update(png).digest('hex');

    await t.test('only organizers upload, and only real image bytes of the declared type are accepted', async () => {
      assert.equal((await handlers.upload(put(png, 'image/png', 'participant'), id)).status, 403);
      assert.equal((await handlers.get(get('participant'), id)).status, 403);
      assert.equal((await handlers.upload(put(Buffer.from('not an image'), 'image/png'), id)).status, 422);
      assert.equal((await handlers.upload(put(jpeg, 'image/png'), id)).status, 422, 'signature must match the declared type');
      assert.equal((await handlers.upload(put(png, 'image/png'), randomUUID())).status, 404);
      const response = await handlers.upload(put(png, 'image/png'), id);
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.equal(data.poster.sha256, sha); assert.equal(data.poster.byteSize, png.length); assert.equal(data.poster.contentType, 'image/png');
      assert.equal(data.poster.url, `/api/v1/content/competition-posters/viyba-2026/${sha.slice(0, 16)}`);
      assert.deepEqual(data.allowedActions, ['upload', 'remove']);
      assert.equal((await handlers.get(get(), id)).status, 200);
    });
    await t.test('oversized bodies are refused before being stored', async () => {
      const big = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024, 0)]);
      assert.equal((await handlers.upload(put(big, 'image/png'), id)).status, 413);
      assert.equal((await db.query('SELECT byte_size FROM gyca_competition_posters WHERE competition_id=$1', [id])).rows[0].byte_size, png.length);
    });
    await t.test('the public image is content-addressed, cacheable and limited to published competitions', async () => {
      const response = await handlers.publicImage('viyba-2026', sha.slice(0, 16));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
      assert.equal(response.headers.get('etag'), `"${sha}"`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
      assert.equal((await handlers.publicImage('viyba-2026', '0'.repeat(16))).status, 404, 'stale address');
      assert.equal((await handlers.publicImage('viyba-2026', 'not-a-version')).status, 422);
      await handlers.upload(put(jpeg, 'image/jpeg'), hidden);
      const hiddenSha = createHash('sha256').update(jpeg).digest('hex');
      assert.equal((await handlers.publicImage('hidden-2026', hiddenSha.slice(0, 16))).status, 404, 'unpublished competition');
    });
    await t.test('the poster is the default card cover and an explicit presentation cover still wins', async () => {
      let items = (await (await cards.list(new Request('https://gyca.test/api'))).json()).data.items;
      assert.equal(items.length, 1);
      assert.equal(items[0].presentation.cover.src, `/api/v1/content/competition-posters/viyba-2026/${sha.slice(0, 16)}`);
      assert.equal(items[0].presentation.cover.alt.ko, 'Contest 포스터');
      const explicit = { expectedRevision: 0, content: { summary: null, category: null, city: null,
        cover: { src: '/images/explicit.jpg', alt: bi('Explicit'), caption: null } }, evidenceReference: 'test' };
      assert.equal((await cards.update(new Request('https://gyca.test/api', { method: 'PUT', headers: { 'content-type': 'application/json',
        origin: 'https://gyca.test', 'x-user': 'editor' }, body: JSON.stringify(explicit) }), id)).status, 200);
      items = (await (await cards.list(new Request('https://gyca.test/api'))).json()).data.items;
      assert.equal(items[0].presentation.cover.src, '/images/explicit.jpg');
    });
    await t.test('removing the poster clears the default cover', async () => {
      assert.equal((await handlers.remove(del('participant'), id)).status, 403);
      const response = await handlers.remove(del(), id);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { competitionId: id, poster: null, allowedActions: ['upload'] });
      assert.equal((await handlers.publicImage('viyba-2026', sha.slice(0, 16))).status, 404);
    });
  } finally { await db.close(); }
});
