import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

const body = (suffix = 'One') => ({ title: { en: `Title ${suffix}`, ko: `제목 ${suffix}` },
  summary: { en: `Summary ${suffix}`, ko: `요약 ${suffix}` }, body: { en: `Body ${suffix}`, ko: `본문 ${suffix}` },
  displayDate: '2027-01-10', coverImage: { src: `/images/${suffix}.jpg`, alt: { en: `Image ${suffix}`, ko: `이미지 ${suffix}` } } });
const jsonRequest = (payload, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', { method: 'POST',
  headers: { 'content-type': 'application/json', origin, ...(actor ? { 'x-test-user': actor } : {}) }, body: JSON.stringify(payload) });

test('editorial CMS keeps drafts private and versions publication and archive transitions', async () => {
  const { createEditorialService } = await import('../src/server/content/editorial.ts');
  const { createEditorialHandlers, createEditorialPublicHandlers } = await import('../src/server/content/editorial-http.ts');
  const db = new PGlite(); let tick = 0; const now = () => new Date(Date.parse('2027-01-10T10:00:00Z') + tick++ * 1000);
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const service = createEditorialService(db, now);
    const admin = createEditorialHandlers({ service, now, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-test-user') });
    const publicApi = createEditorialPublicHandlers(service, now);
    const createInput = { actionId: randomUUID(), slug: 'first-notice', category: 'notice', content: body() };
    assert.equal((await admin.create(jsonRequest(createInput, null))).status, 401);
    assert.equal((await admin.create(jsonRequest(createInput, 'participant'))).status, 403);
    assert.equal((await admin.create(jsonRequest(createInput, 'editor', 'https://evil.test'))).status, 403);
    const createResponse = await admin.create(jsonRequest(createInput)); assert.equal(createResponse.status, 201);
    const draft = (await createResponse.json()).data; assert.equal(draft.status, 'draft'); assert.equal(draft.revision, 1);
    assert.deepEqual(draft.allowedActions, ['edit', 'publish', 'archive']);
    assert.deepEqual((await (await admin.create(jsonRequest(createInput))).json()).data, draft, 'same action replays');
    assert.equal((await admin.create(jsonRequest({ ...createInput, slug: 'changed-slug' }))).status, 409);
    assert.equal((await admin.create(jsonRequest({ ...createInput, actionId: randomUUID() }))).status, 409, 'slug remains unique');
    assert.equal((await publicApi.get(new Request('https://gyca.test/api'), 'first-notice')).status, 404);
    assert.deepEqual((await (await publicApi.list(new Request('https://gyca.test/api?limit=20'))).json()).data.items, []);

    assert.equal((await admin.update(jsonRequest({ actionId: randomUUID(), expectedRevision: 2, content: body('Edit') }), draft.id)).status, 409);
    const updateInput = { actionId: randomUUID(), expectedRevision: 1, content: body('Edit') };
    const edited = (await (await admin.update(jsonRequest(updateInput), draft.id)).json()).data;
    assert.equal(edited.revision, 2); assert.equal(edited.content.title.en, 'Title Edit');
    const publishInput = { actionId: randomUUID(), expectedRevision: 2 };
    const published = (await (await admin.publish(jsonRequest(publishInput), draft.id)).json()).data;
    assert.equal(published.status, 'published'); assert.equal(published.revision, 3); assert.ok(published.publishedAt);
    assert.deepEqual(published.allowedActions, ['edit', 'archive']);
    assert.equal((await admin.publish(jsonRequest({ actionId: randomUUID(), expectedRevision: 3 }), draft.id)).status, 409);
    const publicDetailResponse = await publicApi.get(new Request('https://gyca.test/api'), 'first-notice');
    assert.equal(publicDetailResponse.status, 200); assert.match(publicDetailResponse.headers.get('cache-control'), /max-age=60/);
    const publicDetail = (await publicDetailResponse.json()).data;
    assert.equal(publicDetail.content.body.ko, '본문 Edit'); assert.doesNotMatch(JSON.stringify(publicDetail), /revision|allowedActions|status|createdAt/);

    const publishedEdit = (await (await admin.update(jsonRequest({ actionId: randomUUID(), expectedRevision: 3, content: body('Correction') }), draft.id)).json()).data;
    assert.equal(publishedEdit.status, 'published'); assert.equal(publishedEdit.revision, 4);
    assert.equal(publishedEdit.publishedAt, published.publishedAt, 'first publication time is frozen');
    assert.equal((await (await publicApi.get(new Request('https://gyca.test/api'), 'first-notice')).json()).data.content.title.en, 'Title Correction');

    const secondInput = { actionId: randomUUID(), slug: 'press-release', category: 'press', content: body('Press') };
    const second = (await (await admin.create(jsonRequest(secondInput))).json()).data;
    const secondPublished = (await (await admin.publish(jsonRequest({ actionId: randomUUID(), expectedRevision: 1 }), second.id)).json()).data;
    assert.ok(secondPublished.publishedAt > published.publishedAt);
    const pageOne = (await (await publicApi.list(new Request('https://gyca.test/api?limit=1'))).json()).data;
    assert.equal(pageOne.items[0].slug, 'press-release'); assert.ok(pageOne.nextCursor);
    const pageTwo = (await (await publicApi.list(new Request(`https://gyca.test/api?limit=1&cursor=${pageOne.nextCursor}`))).json()).data;
    assert.equal(pageTwo.items[0].slug, 'first-notice'); assert.equal(pageTwo.nextCursor, null);
    assert.equal((await publicApi.list(new Request(`https://gyca.test/api?category=notice&cursor=${pageOne.nextCursor}`))).status, 422,
      'cursor is bound to category');
    const noticePage = (await (await publicApi.list(new Request('https://gyca.test/api?category=notice'))).json()).data;
    assert.deepEqual(noticePage.items.map(item => item.slug), ['first-notice']);

    const adminList = (await (await admin.listAdmin(new Request('https://gyca.test/api?status=published&category=press',
      { headers: { 'x-test-user': 'editor' } }))).json()).data;
    assert.deepEqual(adminList.items.map(item => item.slug), ['press-release']);
    const archived = (await (await admin.archive(jsonRequest({ actionId: randomUUID(), expectedRevision: 4 }), draft.id)).json()).data;
    assert.equal(archived.status, 'archived'); assert.deepEqual(archived.allowedActions, []);
    assert.equal((await publicApi.get(new Request('https://gyca.test/api'), 'first-notice')).status, 404);
    assert.deepEqual((await (await publicApi.list(new Request('https://gyca.test/api?category=notice'))).json()).data.items, []);
    assert.equal((await admin.update(jsonRequest({ actionId: randomUUID(), expectedRevision: 5, content: body('No') }), draft.id)).status, 409);

    assert.equal((await admin.create(jsonRequest({ actionId: randomUUID(), slug: 'bad-image', category: 'news',
      content: { ...body('Bad'), coverImage: { src: 'http://insecure.test/a.jpg', alt: { en: 'A', ko: 'A' } } } }))).status, 422);
    assert.equal((await admin.create(jsonRequest({ actionId: randomUUID(), slug: 'protocol-relative-image', category: 'news',
      content: { ...body('Bad'), coverImage: { src: '//evil.test/a.jpg', alt: { en: 'A', ko: 'A' } } } }))).status, 422);
    assert.equal((await publicApi.list(new Request('https://gyca.test/api?status=draft'))).status, 422);
    await assert.rejects(db.exec(`UPDATE gyca_editorial_content SET status='draft',revision=revision+1`));
    await assert.rejects(db.exec(`DELETE FROM gyca_editorial_content_changes`));
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'");
    assert.equal((await admin.listAdmin(new Request('https://gyca.test/api', { headers: { 'x-test-user': 'editor' } }))).status, 403);
  } finally { await db.close(); }
});
