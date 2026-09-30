import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createCompetitionAdmin } from '../src/server/competitions/admin.ts';
import { createCompetitionAdminHandlers } from '../src/server/competitions/admin-http.ts';
import { createCompetitionHandlers } from '../src/server/competitions/http.ts';
import { createLaunchReadiness } from '../src/server/competitions/launch-readiness.ts';

test('organizer competition registration and publication', async t => {
  const db = new PGlite(); const now = () => new Date('2026-09-15T00:00:00Z');
  const service = createCompetitionAdmin(db, now);
  const handlers = createCompetitionAdminHandlers({ service, now, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-test-user') });
  const publicApi = createCompetitionHandlers(db, now);
  const input = { slug: 'test-awards', published: false, opensAt: null, closesAt: null, paymentClosesAt: null,
    content: { title: { en: 'Test awards', ko: '테스트 공모' }, fee: { amountMinor: 7000, currency: 'EUR' }, timezone: 'Asia/Seoul',
      keyDates: [], formSpec: null, exhibition: null, guidelines: null } };
  const req = (body, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
    method: body === undefined ? 'GET' : 'POST', headers: { ...(actor === null ? {} : { 'x-test-user': actor }), origin, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const create = () => service.create('editor', { id: randomUUID(), input });
  t.beforeEach(async () => { await db.exec('TRUNCATE gyca_competitions CASCADE'); });
  try {
    await db.exec(`CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','006_payment_confirmations','007_payment_recovery','008_payment_admin','009_payment_routing','010_order_routes','011_competition_admin','032_launch_control'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    await t.test('requires explicit organizer permission and same-origin mutations', async () => {
      assert.equal((await handlers.list(req(undefined, null))).status, 401);
      assert.equal((await handlers.list(req(undefined, 'participant'))).status, 403);
      assert.equal((await handlers.create(req({ id: randomUUID(), input }, 'editor', 'https://evil.test'))).status, 403);
    });
    await t.test('creates hidden content and publishes without opening applications or payments', async () => {
      const created = await create(); assert.equal(created.revision, 1);
      assert.equal((await publicApi.get(req(), input.slug)).status, 404);
      const updated = await service.update('editor', created.id, { revision: 1, input: { ...input, published: true } });
      assert.equal(updated.revision, 2); assert.equal(updated.draftEnabled, false); assert.equal(updated.paymentEnabled, false);
      const response = await publicApi.get(req(), input.slug); assert.equal(response.status, 200);
      const body = await response.json(); assert.equal(body.data.title.en, input.content.title.en);
      assert.deepEqual(body.data.allowedActions, []);
      await service.update('editor', created.id, { revision: 2, input });
      assert.equal((await publicApi.get(req(), input.slug)).status, 404);
    });
    await t.test('detects duplicate slug, stale edits and protects stable URLs', async () => {
      const created = await create();
      await assert.rejects(create(), { code: 'IDEMPOTENCY_CONFLICT' });
      await assert.rejects(service.update('editor', created.id, { revision: 2, input }), { code: 'REVISION_CONFLICT' });
      await assert.rejects(service.update('editor', created.id, { revision: 1, input: { ...input, slug: 'changed' } }), { code: 'VALIDATION_FAILED' });
    });
    await t.test('rejects input escalation, invalid timezone and reversed deadline', async () => {
      for (const value of [{ ...input, draftEnabled: true }, { ...input, content: { ...input.content, timezone: 'wrong/time' } },
        { ...input, opensAt: '2026-10-02T00:00:00Z', closesAt: '2026-10-01T00:00:00Z' }])
        assert.equal((await handlers.create(req({ id: randomUUID(), input: value }))).status, 422);
    });
    await t.test('active or used competitions are locked against wholesale edits', async () => {
      const created = await create();
      await db.query('UPDATE gyca_competitions SET draft_enabled=true WHERE id=$1', [created.id]);
      await assert.rejects(service.update('editor', created.id, { revision: 1, input }), { code: 'ENTRY_LOCKED' });
      await db.query('UPDATE gyca_competitions SET draft_enabled=false WHERE id=$1', [created.id]);
      await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'participant',$2)", [randomUUID(), created.id]);
      await assert.rejects(service.update('editor', created.id, { revision: 1, input }), { code: 'ENTRY_LOCKED' });
    });
    await t.test('audit is immutable and audit failure rolls back registration', async () => {
      await create();
      await assert.rejects(db.query('DELETE FROM gyca_competition_changes'), /immutable/);
      const broken = { transaction: run => db.transaction(tx => run({ query: (sql, values) => {
        if (sql.includes('INSERT INTO gyca_competition_changes')) throw new Error('audit failure');
        return tx.query(sql, values);
      } })) };
      await assert.rejects(createCompetitionAdmin(broken, now).create('editor', { id: randomUUID(), input: { ...input, slug: 'rollback' } }), /audit failure/);
      assert.equal((await db.query("SELECT id FROM gyca_competitions WHERE slug='rollback'")).rows.length, 0);
    });
    await t.test('lists unpublished competitions and reads editable values', async () => {
      const created = await create();
      const response = await handlers.list(req()); assert.equal(response.status, 200);
      assert.equal((await response.json()).data.items.length, 1);
      assert.equal((await service.get('editor', created.id)).input.slug, input.slug);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    });
    await t.test('launch diagnostics report gaps without granting opening actions or exposing policies', async () => {
      const created = await create();
      const assess = createLaunchReadiness(db, { providers: [], now });
      await assert.rejects(assess('participant', created.id), { code: 'FORBIDDEN' });
      await assert.rejects(assess('editor', randomUUID()), { code: 'NOT_FOUND' });
      const result = await assess('editor', created.id);
      assert.equal(result.canOpen, false); assert.deepEqual(result.allowedActions, []);
      const checks = Object.fromEntries(result.checks.map(check => [check.code, check.status]));
      assert.equal(checks.public_content, 'configured'); assert.equal(checks.published, 'missing');
      for (const code of ['schedule','form','consents','guardian_policy','payment_policy','payment_routes','storage','guardian_verification','checkout','retention'])
        assert.equal(checks[code], 'missing', code);
      assert.equal(checks.live_payment_verification, 'unverified');
      assert.equal(JSON.stringify(result).includes('guardianAgeByCountry'), false);
    });
  } finally { await db.close(); }
});
