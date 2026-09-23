import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { submissionScenarios } from '../docs/backend/examples/submission-scenarios.mjs';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { createPauseApplicationsHandler } from '../src/server/competitions/pause-applications.ts';
import { createPaymentService } from '../src/server/payments/service.ts';
import { createRoutedOrders } from '../src/server/payments/routed-orders.ts';
import { routingToken } from '../src/server/payments/options.ts';
import { createUploadService } from '../src/server/uploads/service.ts';

test('paused intake blocks drafts but preserves submitted payment and exactly one receipt', async () => {
  const db = new PGlite();
  const now = () => new Date('2026-09-16T00:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      INSERT INTO "user" VALUES('alice','alice@example.org',true),('editor','editor@example.org',true)`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const demo = submissionScenarios.find(item => item.id === 'first-release');
    const content = { title: demo.competition.title, fee: demo.competition.fee, timezone: 'Asia/Seoul',
      keyDates: [], exhibition: null, guidelines: null, formSpec: { ...demo.competition.formSpec, ageReferenceDate: '2026-01-01',
        ageGroups: [{ id: 'youth', label: { en: 'Youth', ko: '청소년' }, minAgeInclusive: 7, maxAgeInclusive: 19 }] } };
    const policy = { enabled: true, version: 'fixture', guardianAgeBasis: 'submission_date_in_competition_timezone',
      guardianAgeByCountry: { KR: 14 }, documents: demo.documents };
    const routing = { version: 'fixture', routes: [{ id: 'test-card', enabled: true, provider: 'fixture', merchantAccount: 'test-mid', liveMode: false,
      countries: ['KR'], currency: 'EUR', approvalReference: 'fixture-only', label: { en: 'Test', ko: '테스트' }, refundNotice: { en: 'Test', ko: '테스트' } }] };
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,draft_enabled,payment_enabled,opens_at,closes_at,payment_closes_at,public_content,submission_policy,payment_policy,payment_routing)
      VALUES('test','test',true,true,true,'2026-01-01Z','2027-01-01Z','2027-01-02Z',$1,$2,$3,$4)`,
      [JSON.stringify(content), JSON.stringify(policy), JSON.stringify({ version: 'fixture', approvalBasis: 'provider_paid_at' }), JSON.stringify(routing)]);
    const entries = createEntryRepository(db, now);
    const draft = await entries.create('alice', 'test', 'first');
    const saved = await entries.update('alice', draft.id, { ...demo.draft, revision: draft.revision,
      participant: { ...demo.draft.participant, dateOfBirth: '2008-01-01' } });
    // Already-inspected asset fixtures isolate the pause/payment integration from S3 transport.
    for (const [purpose, type, pages] of [['cover_image', 'image/png', null], ['book_pdf', 'application/pdf', 20]])
      await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,
        object_key,object_version,checksum,state,size_bytes,page_count,expires_at)
        VALUES($1,$2,$3,'fixture',$3,$3,100,$4,1024,$5,'version-1',$6,'ready',100,$7,'2027-01-01Z')`,
        [randomUUID(), draft.id, purpose, type, randomUUID(), 'a'.repeat(64), pages]);
    const readiness = await entries.readiness('alice', draft.id, 'en');
    assert.deepEqual(readiness.allowedActions, ['submit']);
    await entries.submit('alice', draft.id, 'submit', { revision: saved.revision, locale: 'en', policyToken: readiness.policyToken,
      consents: readiness.documents.map(doc => ({ kind: doc.kind, version: doc.version, accepted: true })) });
    const unfinished = await entries.create('alice', 'test', 'second');
    const pause = createPauseApplicationsHandler({ database: db, now, origin: 'https://gyca.test', getUserId: async () => 'editor' });
    assert.equal((await pause(new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 1, reason: 'Test incident' }) }), 'test')).status, 200);
    await assert.rejects(entries.create('alice', 'test', 'third'), { code: 'POLICY_NOT_CONFIGURED' });
    await assert.rejects(entries.update('alice', unfinished.id, { revision: unfinished.revision, work: { title: 'edit' } }), { code: 'POLICY_NOT_CONFIGURED' });
    assert.deepEqual((await entries.readiness('alice', unfinished.id, 'en')).allowedActions, []);
    await assert.rejects(entries.submit('alice', unfinished.id, 'blocked-submit', { revision: unfinished.revision, locale: 'en',
      policyToken: readiness.policyToken, consents: readiness.documents.map(doc => ({ kind: doc.kind, version: doc.version, accepted: true })) }), { code: 'POLICY_NOT_CONFIGURED' });
    const uploads = createUploadService(db, null, async () => assert.fail('inspection must not run'), now);
    await assert.rejects(uploads.create('alice', unfinished.id, 'upload', { revision: unfinished.revision, purpose: 'book_pdf', filename: 'test.pdf', sizeBytes: 100, mediaType: 'application/pdf' }), { code: 'POLICY_NOT_CONFIGURED' });
    let confirmations = 0;
    const provider = { id: 'fixture', merchantAccount: 'test-mid', liveMode: false, confirmationReplayWindowMs: 86400000,
      confirm: async (order, paymentKey, key) => { confirmations++; return { eventId: key, paymentId: paymentKey, orderId: order.id,
        merchantAccount: 'test-mid', liveMode: false, state: 'succeeded', amountMinor: 7000, currency: 'EUR', paidAt: now().toISOString() }; },
      reconcile: async () => [], verifyWebhook: async () => assert.fail('not used') };
    const createOrder = createRoutedOrders(db, { providers: [provider], now });
    const order = await createOrder('alice', { entryId: draft.id, key: 'order' }, { routeId: 'test-card', policyToken: routingToken(routing), acceptedRefundNotice: true });
    const payments = createPaymentService(db, provider, now);
    await payments.confirm('alice', order.id, 'payment-key');
    const received = await entries.get('alice', draft.id);
    assert.equal(received.entryStatus, 'received'); assert.ok(received.receiptNumber);
    await payments.confirm('alice', order.id, 'payment-key');
    assert.equal((await entries.get('alice', draft.id)).receiptNumber, received.receiptNumber);
    assert.equal(confirmations, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM gyca_payment_outbox WHERE kind='entry_received'")).rows[0].n, 1);
  } finally { await db.close(); }
});
