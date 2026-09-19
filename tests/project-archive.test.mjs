import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations, platformMigrationNames } from '../scripts/lib/platform-migrations.mjs';

const bi = value => ({ en: value, ko: value });
const body = () => ({ projectType: 'art', completionYear: 2025, hero: {
  program: bi('Klimt Villa'), summary: bi('Completed project'), location: bi('Vienna'), period: bi('2025'),
  operated: [bi('Exhibition')], image: null }, sections: [
  { kind: 'intro', order: 1, title: bi('Introduction'), status: 'ready', optional: false,
    intro: bi('Project introduction'), gallery: [], documents: [], quotes: [], stats: [], pendingNote: null },
  { kind: 'selection', order: 3, title: bi('Selected works'), status: 'ready', optional: false,
    intro: null, gallery: [{ src: '/images/archive/art.jpg', alt: bi('Work'), caption: bi('Author credit') }],
    documents: [], quotes: [], stats: [], pendingNote: null },
  { kind: 'buyer_interviews', order: 7, title: bi('Interviews'), status: 'pending', optional: false,
    intro: bi('PRIVATE UNAPPROVED'), gallery: [], documents: [],
    quotes: [{ quote: bi('PRIVATE QUOTE'), attribution: bi('PRIVATE NAME') }], stats: [], pendingNote: bi('Coming later') },
] });
const request = (value, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
  method: 'POST', headers: { 'content-type': 'application/json', origin, ...(actor ? { 'x-user': actor } : {}) },
  body: JSON.stringify(value) });
const get = path => new Request(`https://gyca.test/api${path}`, { headers: { 'x-user': 'editor' } });
const payload = async response => { assert.ok(response.ok, await response.clone().text()); return (await response.json()).data; };

test('Given an archive publication, public HTTP exposes only approved content and withdrawals remove it', async t => {
  assert.ok(platformMigrationNames.includes('038_project_archives'), 'archive history must be in the official migration chain');
  const { createArchiveService } = await import('../src/server/content/archives.ts');
  const { createArchiveHandlers, createArchivePublicHandlers } = await import('../src/server/content/archives-http.ts');
  const { ArchiveContentSchema } = await import('../src/contracts/project-archive.ts');
  const db = new PGlite(); const now = () => new Date('2026-09-19T00:00:00Z');
  try {
    await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES (\'editor\'),(\'participant\')');
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const service = createArchiveService(db, now);
    const admin = createArchiveHandlers({ service, now, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const publicApi = createArchivePublicHandlers(service, now);
    const created = await payload(await admin.create(request({ actionId: randomUUID(), slug: 'klimt-villa', content: body() })));

    await t.test('When viewing a draft, anonymous users receive no project', async () => {
      assert.equal((await publicApi.get(get(''), 'klimt-villa')).status, 404);
      assert.deepEqual((await payload(await publicApi.list(get('')))).items, []);
    });
    await t.test('When publishing without evidence or proper authority, the request is refused', async () => {
      const input = { actionId: randomUUID(), expectedRevision: 1 };
      assert.equal((await admin.publish(request(input), created.id)).status, 422);
      const valid = { ...input, evidence: { sourceReference: 'source', rightsReference: 'rights', confirmedForPublication: true } };
      assert.equal((await admin.publish(request(valid, 'participant'), created.id)).status, 403);
      assert.equal((await admin.publish(request(input, null), created.id)).status, 401);
      assert.equal((await admin.publish(request(input, 'editor', 'https://evil.test'), created.id)).status, 403);
    });
    await t.test('When a draft contains invalid media or duplicate sections, its schema refuses it', () => {
      const content = body();
      assert.equal(ArchiveContentSchema.safeParse({ ...content, sections: [...content.sections, content.sections[0]] }).success, false);
      for (const src of ['relative-file.jpg', '//evil.test/a', '/\\evil.test/a', 'https://user:secret@site.test/a', 'https://site.test/a?token=SECRET', 'http://site.test/a']) {
        assert.equal(ArchiveContentSchema.safeParse({ ...content, hero: { ...content.hero, image: { src, alt: bi('x'), caption: null } } }).success, false);
      }
    });
    const publishInput = { actionId: randomUUID(), expectedRevision: 1,
      evidence: { sourceReference: 'internal-confirmed-project', rightsReference: 'internal-publication-rights', confirmedForPublication: true } };
    const published = await payload(await admin.publish(request(publishInput), created.id));
    await t.test('When a confirmed archive is read, evidence and pending payloads never cross the public boundary', async () => {
      const response = await publicApi.get(get(''), 'klimt-villa');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const detail = await payload(response);
      assert.equal(detail.status, 'completed');
      assert.deepEqual(detail.sections.map(s => s.order), [1, 3, 7]);
      assert.equal(detail.sections[2].status, 'pending');
      assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|internal-|rightsReference|actorId|revision|entryId|ownerId/);
      assert.equal((await payload(await publicApi.list(get(''), 'selection'))).items.length, 1);
      assert.equal((await payload(await publicApi.list(get(''), 'exhibition_photos'))).items.length, 0);
    });
    await t.test('When a publication action is retried, it returns the same revision or a changed-payload conflict', async () => {
      assert.deepEqual(await payload(await admin.publish(request(publishInput), created.id)), published);
      assert.equal((await admin.publish(request({ ...publishInput, evidence: { ...publishInput.evidence, rightsReference: 'changed' } }), created.id)).status, 409);
    });
    await t.test('When a published document is edited, it requires a fresh publication approval', async () => {
      const edited = await payload(await admin.update(request({ actionId: randomUUID(), expectedRevision: 2, content: body() }), created.id));
      assert.equal(edited.status, 'draft'); assert.equal(edited.revision, 3);
      assert.equal((await publicApi.get(get(''), 'klimt-villa')).status, 404);
      assert.equal((await admin.publish(request({ ...publishInput, actionId: randomUUID() }), created.id)).status, 409);
    });
    await payload(await admin.publish(request({ ...publishInput, actionId: randomUUID(), expectedRevision: 3 }), created.id));
    await t.test('When using public HTTP, consumers receive the published project and strict query errors', async () => {
      const server = createServer(async (req, res) => {
        const response = await publicApi.list(new Request(`http://localhost${req.url}`));
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
      });
      server.listen(0, '127.0.0.1'); await once(server, 'listening');
      try {
        const url = `http://127.0.0.1:${server.address().port}`;
        assert.equal((await payload(await fetch(`${url}/?limit=1`))).items[0].slug, 'klimt-villa');
        assert.equal((await fetch(`${url}/?status=draft`)).status, 422);
        assert.equal((await fetch(`${url}/?limit=1&limit=2`)).status, 422);
      } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
    });
    await t.test('When archiving a published project, every public collection excludes it', async () => {
      const archived = await payload(await admin.archive(request({ actionId: randomUUID(), expectedRevision: 4 }), created.id));
      assert.equal(archived.status, 'archived'); assert.deepEqual(archived.allowedActions, []);
      assert.equal((await publicApi.get(get(''), 'klimt-villa')).status, 404);
      assert.equal((await payload(await publicApi.list(get(''), 'selection'))).items.length, 0);
    });
    await t.test('When directly rewriting the projection or evidence, database integrity blocks it', async () => {
      await assert.rejects(db.exec("UPDATE gyca_project_archives SET status='published',revision=revision+1"));
      await assert.rejects(db.exec('DELETE FROM gyca_archive_changes'));
      await assert.rejects(db.exec('DELETE FROM gyca_archive_publications'));
      await assert.rejects(db.exec('DELETE FROM gyca_archive_actions'));
    });
    await t.test('When the same create action is submitted concurrently, only one archive is created', async () => {
      const input = { actionId: randomUUID(), slug: 'another-project', content: body() };
      const results = await Promise.all([admin.create(request(input)), admin.create(request(input))]);
      assert.deepEqual(await payload(results[0]), await payload(results[1]));
    });
    await t.test('When changing collection mid-pagination, a project cursor is refused by the winners collection', async () => {
      for (const slug of ['page-one', 'page-two']) {
        const project = await payload(await admin.create(request({ actionId: randomUUID(), slug, content: body() })));
        await payload(await admin.publish(request({ ...publishInput, actionId: randomUUID() }), project.id));
      }
      const first = await payload(await publicApi.list(get('?limit=1')));
      assert.ok(first.nextCursor);
      const second = await payload(await publicApi.list(get(`?limit=1&cursor=${first.nextCursor}`)));
      assert.notEqual(first.items[0].id, second.items[0].id);
      assert.equal((await publicApi.list(get(`?cursor=${first.nextCursor}`), 'selection')).status, 422);
    });
  } finally { await db.close(); }
});
