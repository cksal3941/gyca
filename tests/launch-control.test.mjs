import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { submissionScenarios } from '../docs/backend/examples/submission-scenarios.mjs';
import { createLaunchReadiness } from '../src/server/competitions/launch-readiness.ts';
import { createLaunchControl } from '../src/server/competitions/launch-control.ts';
import { createLaunchControlHandlers } from '../src/server/competitions/launch-control-http.ts';

test('launch control opens applications and payments only after current external evidence', async (t) => {
  const db = new PGlite(); const at = new Date('2026-09-19T00:00:00Z'); const now = () => at;
  const provider = { id: 'fixture', merchantAccount: 'live-mid', liveMode: true,
    beginCheckout: async () => assert.fail('not used'), verifyWebhook: async () => ({}), reconcile: async () => [] };
  const assess = createLaunchReadiness(db, { providers: [provider], now, storageConfigured: true, guardianVerificationConfigured: true });
  const service = createLaunchControl(db, now, assess);
  const handlers = createLaunchControlHandlers({ service, now, origin: 'https://gyca.test',
    getUserId: async request => request.headers.get('x-test-user') });
  const validUntil = new Date(at.getTime() + 86400000).toISOString();
  const req = (body, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
    method: 'POST', headers: { 'x-test-user': actor, origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  async function configure() {
    const demo = submissionScenarios.find(item => item.id === 'first-release');
    const content = { title: demo.competition.title, fee: demo.competition.fee, timezone: 'Asia/Seoul', keyDates: [],
      exhibition: null, guidelines: null, formSpec: { ...demo.competition.formSpec, ageReferenceDate: '2026-01-01',
        ageGroups: [{ id: 'youth', label: { en: 'Youth', ko: '청소년' }, minAgeInclusive: 7, maxAgeInclusive: 19 }] } };
    const submission = { enabled: true, version: 'launch-v1', guardianAgeBasis: 'submission_date_in_competition_timezone',
      guardianAgeByCountry: { KR: 14 }, documents: demo.documents };
    const routing = { version: 'launch-v1', routes: [{ id: 'live-card', enabled: true, provider: 'fixture', merchantAccount: 'live-mid',
      liveMode: true, countries: ['KR'], currency: 'EUR', approvalReference: 'verified merchant agreement',
      label: { en: 'Card', ko: '카드' }, refundNotice: { en: 'Approved terms', ko: '승인된 규정' } }] };
    const retention = { enabled: true, version: 'retention-v1', withdrawnDraftAssets: { deleteAfterDays: 30 },
      unselectedSubmissionAssets: { deleteAfterDays: 90 }, selectedSubmissionAssets: { deleteAfterDays: 365 },
      consentEvidence: { retainDays: 365 }, paymentEvidence: { retainDays: 365 } };
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,phase,opens_at,closes_at,payment_closes_at,public_content,
      submission_policy,payment_policy,payment_routing,retention_policy)
      VALUES('one','one',true,'scheduled','2026-09-01Z','2027-01-01Z','2027-01-02Z',$1,$2,$3,$4,$5)`,
    [content, submission, { version: 'launch-v1', approvalBasis: 'provider_paid_at' }, routing, retention]);
  }
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      INSERT INTO "user" VALUES('editor','editor@example.org',true),('participant','participant@example.org',true)`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    await configure();

    await t.test('requires all three unexpired verifications bound to the current revision', async () => {
      const initial = await assess('editor', 'one');
      assert.equal(initial.canOpen, false);
      for (const code of ['storage','retention','live_payment_verification'])
        assert.equal(initial.checks.find(check => check.code === code).status, 'unverified');
      for (const code of ['storage','retention','live_payment_verification']) {
        await service.recordVerification('editor', 'one', { actionId: randomUUID(), expectedRevision: 1, code,
          evidenceReference: `${code}:staging-check-2026-09-19`, validUntil });
      }
      const ready = await assess('editor', 'one');
      assert.equal(ready.canOpen, true); assert.deepEqual(ready.allowedActions, ['open_applications']);
      assert.ok(ready.checks.every(check => check.status === 'configured'));
    });

    await t.test('opens draft and payment gates atomically with immutable evidence and replay', async () => {
      const input = { actionId: randomUUID(), expectedRevision: 1, reason: 'Launch approval meeting completed' };
      const opened = await service.open('editor', 'one', input);
      assert.equal(opened.revision, 2); assert.equal(opened.draftEnabled, true); assert.equal(opened.paymentEnabled, true);
      assert.deepEqual(await service.open('editor', 'one', input), opened);
      await assert.rejects(service.open('editor', 'one', { ...input, reason: 'changed' }), { code: 'IDEMPOTENCY_CONFLICT' });
      assert.deepEqual((await db.query("SELECT revision,draft_enabled,payment_enabled FROM gyca_competitions WHERE id='one'")).rows[0],
        { revision: 2, draft_enabled: true, payment_enabled: true });
      const audit = (await db.query('SELECT readiness_snapshot FROM gyca_application_opens')).rows[0].readiness_snapshot;
      assert.equal(audit.canOpen, true); assert.equal(JSON.stringify(audit).includes('evidence_reference'), false);
      await assert.rejects(db.query('DELETE FROM gyca_application_opens'), /immutable/);
      assert.equal((await assess('editor', 'one')).canOpen, false);
    });

    await t.test('HTTP blocks unauthorized, cross-origin, stale and expanded requests', async () => {
      // Keep this boundary test on a second configured competition so the opened fixture remains immutable.
      await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('two','two')");
      const verification = { actionId: randomUUID(), expectedRevision: 1, code: 'storage',
        evidenceReference: 'storage:check', validUntil };
      assert.equal((await handlers.recordVerification(req(verification, 'participant'), 'two')).status, 403);
      assert.equal((await handlers.recordVerification(req(verification, 'editor', 'https://evil.test'), 'two')).status, 403);
      assert.equal((await handlers.recordVerification(req({ ...verification, secretKey: 'never' }), 'two')).status, 422);
      assert.equal((await handlers.recordVerification(req({ ...verification, expectedRevision: 2 }), 'two')).status, 409);
      assert.equal((await handlers.open(req({ actionId: randomUUID(), expectedRevision: 1, reason: 'not ready' }), 'two')).status, 503);
    });
  } finally { await db.close(); }
});
