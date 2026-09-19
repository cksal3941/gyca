import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

const body = (suffix = 'One', displayOrder = 10) => ({
  name: { en: `Partner ${suffix}`, ko: `파트너 ${suffix}` },
  description: { en: `Description ${suffix}`, ko: `설명 ${suffix}` }, displayOrder,
  websiteUrl: 'https://partner.example.org',
  logo: { src: `/images/partners/${suffix}.svg`, alt: { en: `Logo ${suffix}`, ko: `로고 ${suffix}` } },
});
const jsonRequest = (payload, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', { method: 'POST',
  headers: { 'content-type': 'application/json', origin, ...(actor ? { 'x-test-user': actor } : {}) }, body: JSON.stringify(payload) });
const data = async response => (await response.json()).data;

test('partner CMS publishes only confirmed relationships and revocation immediately removes public access', async () => {
  const { createPartnerService } = await import('../src/server/content/partners.ts');
  const { createPartnerHandlers, createPartnerPublicHandlers } = await import('../src/server/content/partners-http.ts');
  const db = new PGlite(); let tick = 0; const now = () => new Date(Date.parse('2027-01-10T10:00:00Z') + tick++ * 1000);
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const service = createPartnerService(db, now);
    const admin = createPartnerHandlers({ service, now, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-test-user') });
    const publicApi = createPartnerPublicHandlers(service, now);
    const createInput = { actionId: randomUUID(), slug: 'vienna-venue', partnerType: 'venue', content: body() };

    assert.equal((await admin.create(jsonRequest(createInput, null))).status, 401);
    assert.equal((await admin.create(jsonRequest(createInput, 'participant'))).status, 403);
    assert.equal((await admin.create(jsonRequest(createInput, 'editor', 'https://evil.test'))).status, 403);
    const createdResponse = await admin.create(jsonRequest(createInput)); assert.equal(createdResponse.status, 201);
    const draft = await data(createdResponse); assert.equal(draft.relationshipStatus, 'pending'); assert.equal(draft.status, 'draft');
    assert.deepEqual(draft.allowedActions, ['edit', 'confirm_relationship', 'archive']);
    assert.deepEqual(await data(await admin.create(jsonRequest(createInput))), draft, 'same action replays');
    assert.equal((await admin.create(jsonRequest({ ...createInput, slug: 'changed' }))).status, 409);
    assert.equal((await admin.create(jsonRequest({ ...createInput, actionId: randomUUID() }))).status, 409, 'slug remains unique');
    assert.equal((await admin.publish(jsonRequest({ actionId: randomUUID(), expectedRevision: 1 }), draft.id)).status, 409,
      'pending relationships cannot be published');
    assert.equal((await publicApi.get(new Request('https://gyca.test/api'), createInput.slug)).status, 404);
    assert.deepEqual((await data(await publicApi.list(new Request('https://gyca.test/api')))).items, []);

    assert.equal((await admin.confirm(jsonRequest({ actionId: randomUUID(), expectedRevision: 1,
      evidenceReference: '', reason: 'Confirmed by signed agreement' }), draft.id)).status, 422);
    const confirmation = { actionId: randomUUID(), expectedRevision: 1,
      evidenceReference: '/admin/evidence/partner-agreement-2027-01', reason: 'Signed cooperation agreement verified' };
    const confirmed = await data(await admin.confirm(jsonRequest(confirmation), draft.id));
    assert.equal(confirmed.relationshipStatus, 'confirmed'); assert.equal(confirmed.revision, 2);
    assert.deepEqual(confirmed.allowedActions, ['edit', 'publish', 'archive', 'revoke_relationship']);
    assert.equal((await admin.confirm(jsonRequest({ ...confirmation, actionId: randomUUID(), expectedRevision: 2 }), draft.id)).status, 409);
    assert.equal((await publicApi.get(new Request('https://gyca.test/api'), createInput.slug)).status, 404,
      'confirmation alone does not publish');

    const published = await data(await admin.publish(jsonRequest({ actionId: randomUUID(), expectedRevision: 2 }), draft.id));
    assert.equal(published.status, 'published'); assert.equal(published.revision, 3); assert.ok(published.publishedAt);
    const publicResponse = await publicApi.get(new Request('https://gyca.test/api'), createInput.slug);
    assert.equal(publicResponse.status, 200); assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    const publicPartner = await data(publicResponse); assert.equal(publicPartner.content.name.en, 'Partner One');
    assert.doesNotMatch(JSON.stringify(publicPartner), /relationshipStatus|revision|allowedActions|createdAt|evidenceReference|reason/);

    const updated = await data(await admin.update(jsonRequest({ actionId: randomUUID(), expectedRevision: 3,
      content: body('Updated', 20) }), draft.id));
    assert.equal(updated.revision, 4); assert.equal(updated.publishedAt, published.publishedAt, 'first publication time is frozen');
    const secondCreated = await data(await admin.create(jsonRequest({ actionId: randomUUID(), slug: 'international-program',
      partnerType: 'international_program_partner', content: body('Program', 5) })));
    const secondConfirmed = await data(await admin.confirm(jsonRequest({ actionId: randomUUID(), expectedRevision: 1,
      evidenceReference: 'https://records.example.org/agreement/2', reason: 'Agreement verified' }), secondCreated.id));
    await admin.publish(jsonRequest({ actionId: randomUUID(), expectedRevision: secondConfirmed.revision }), secondCreated.id);

    const firstPage = await data(await publicApi.list(new Request('https://gyca.test/api?limit=1')));
    assert.deepEqual(firstPage.items.map(item => item.slug), ['international-program']); assert.ok(firstPage.nextCursor);
    const secondPage = await data(await publicApi.list(new Request(`https://gyca.test/api?limit=1&cursor=${firstPage.nextCursor}`)));
    assert.deepEqual(secondPage.items.map(item => item.slug), ['vienna-venue']); assert.equal(secondPage.nextCursor, null);
    assert.equal((await publicApi.list(new Request(`https://gyca.test/api?partnerType=venue&cursor=${firstPage.nextCursor}`))).status, 422,
      'cursor is bound to the partner type filter');
    assert.deepEqual((await data(await publicApi.list(new Request('https://gyca.test/api?partnerType=venue')))).items.map(item => item.slug),
      ['vienna-venue']);
    assert.equal((await publicApi.list(new Request('https://gyca.test/api?relationshipStatus=pending'))).status, 422);

    const adminList = await data(await admin.listAdmin(new Request('https://gyca.test/api?status=published&relationshipStatus=confirmed',
      { headers: { 'x-test-user': 'editor' } })));
    assert.equal(adminList.items.length, 2);
    const revoke = { actionId: randomUUID(), expectedRevision: updated.revision,
      evidenceReference: '/admin/evidence/revocation-2027-02', reason: 'Institution withdrew its authorization' };
    const revoked = await data(await admin.revoke(jsonRequest(revoke), draft.id));
    assert.equal(revoked.relationshipStatus, 'revoked'); assert.equal(revoked.status, 'archived');
    assert.deepEqual(revoked.allowedActions, []);
    assert.equal((await publicApi.get(new Request('https://gyca.test/api'), createInput.slug)).status, 404);
    assert.deepEqual((await data(await publicApi.list(new Request('https://gyca.test/api?partnerType=venue')))).items, []);
    assert.equal((await admin.update(jsonRequest({ actionId: randomUUID(), expectedRevision: revoked.revision,
      content: body('No') }), draft.id)).status, 409);

    assert.equal((await admin.create(jsonRequest({ actionId: randomUUID(), slug: 'bad-website', partnerType: 'organizer',
      content: { ...body('Bad'), websiteUrl: 'http://insecure.test' } }))).status, 422);
    assert.equal((await admin.create(jsonRequest({ actionId: randomUUID(), slug: 'bad-logo', partnerType: 'organizer',
      content: { ...body('Bad'), logo: { src: '//evil.test/logo.svg', alt: { en: 'A', ko: 'A' } } } }))).status, 422);
    await assert.rejects(db.exec("UPDATE gyca_partners SET relationship_status='revoked',status='archived',revision=revision+1 WHERE id='" + secondCreated.id + "'"));
    await assert.rejects(db.exec('DELETE FROM gyca_partner_relationship_events'));
    await assert.rejects(db.exec('DELETE FROM gyca_partner_changes'));
    await assert.rejects(db.exec('DELETE FROM gyca_partner_actions'));
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'");
    assert.equal((await admin.listAdmin(new Request('https://gyca.test/api', { headers: { 'x-test-user': 'editor' } }))).status, 403);
  } finally { await db.close(); }
});
