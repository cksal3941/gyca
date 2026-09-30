import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations, platformMigrationNames } from '../scripts/lib/platform-migrations.mjs';

test('Given an existing competition, presentation edits preserve intake rules and hidden venues', async t => {
  assert.ok(platformMigrationNames.includes('039_competition_presentation'), 'presentation must persist through official migrations');
  const { createPresentationService } = await import('../src/server/content/competition-presentation.ts');
  const { createPresentationHandlers } = await import('../src/server/content/competition-presentation-http.ts');
  const db = new PGlite(); const now = () => new Date('2026-09-19T00:00:00Z');
  const bi = value => ({ en: value, ko: value }); const id = randomUUID(); const hidden = randomUUID();
  try {
    await db.exec('CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES (\'editor\'),(\'participant\')');
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const content = { title: bi('Contest'), fee: { currency: 'EUR', amountMinor: 7000 }, timezone: 'Europe/Berlin',
      keyDates: [], formSpec: null, exhibition: null, guidelines: null };
    for (const [compId, visible] of [[id, true], [hidden, false]]) await db.query(`INSERT INTO gyca_competitions
      (id,slug,published,public_content,opens_at,closes_at) VALUES($1,$1,$2,$3::jsonb,'2026-09-01','2026-10-01')`, [compId, visible, JSON.stringify(content)]);
    const handlers = createPresentationHandlers({ service: createPresentationService(db, now), now,
      origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-user') });
    const request = (input, actor = 'editor') => new Request('https://gyca.test/api', { method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'https://gyca.test', 'x-user': actor }, body: JSON.stringify(input) });
    const input = { expectedRevision: 0, content: { summary: bi('Editorial summary'), category: bi('Art'),
      city: bi('PRIVATE VENUE CITY'), cover: { src: '/images/contest.jpg', alt: bi('Poster'), caption: null } },
      evidenceReference: 'internal-approved-poster' };
    const list = () => handlers.list(new Request('https://gyca.test/api'));
    await t.test('When an old competition has no presentation, the card still exposes its actual readiness', async () => {
      const response = await list(); const items = (await response.json()).data.items;
      assert.equal(items.length, 1); assert.equal(items[0].presentation.summary, null);
      assert.deepEqual(items[0].competition.allowedActions, []);
    });
    await t.test('When presentation is saved, authority and revision are checked', async () => {
      assert.equal((await handlers.update(request(input, 'participant'), id)).status, 403);
      assert.equal((await handlers.update(request(input), id)).status, 200);
      assert.equal((await handlers.update(request(input), id)).status, 409);
    });
    await t.test('When a card is published, city remains hidden until exhibition approval', async () => {
      const response = await list(); assert.equal(response.headers.get('cache-control'), 'no-store');
      const card = (await response.json()).data.items[0];
      assert.equal(card.presentation.summary.en, input.content.summary.en);
      assert.equal(card.presentation.cover.src, input.content.cover.src);
      assert.equal(card.presentation.city, null);
      assert.equal(card.competition.fee.amountMinor, 7000);
      assert.equal(card.competition.readiness.application, false);
      assert.doesNotMatch(JSON.stringify(card), /PRIVATE VENUE CITY|internal-approved-poster|evidenceReference/);
    });
    await t.test('When an existing card is edited again, the new revision is persisted and published', async () => {
      const updated = { ...input, expectedRevision: 1, content: { ...input.content, summary: bi('Corrected summary') } };
      const response = await handlers.update(request(updated), id);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.revision, 2);
      assert.equal((await (await list()).json()).data.items[0].presentation.summary.en, 'Corrected summary');
      assert.equal((await handlers.update(request(updated), id)).status, 409);
    });
    await t.test('When changing presentation, price or dates cannot be injected', async () => {
      assert.equal((await handlers.update(request({ ...input, expectedRevision: 1,
        content: { ...input.content, fee: { amountMinor: 1, currency: 'EUR' } } }), id)).status, 422);
      await assert.rejects(db.exec('DELETE FROM gyca_competition_presentation_changes'));
      await assert.rejects(db.exec('UPDATE gyca_competition_presentations SET revision=revision+1'));
    });
  } finally { await db.close(); }
});
