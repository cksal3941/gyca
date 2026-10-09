import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentService } from '../src/server/payments/service.ts';
import { createPaymentHandlers } from '../src/server/payments/http.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { EntryFault } from '../src/server/entries/errors.ts';
import { createTossProvider } from '../src/server/payments/toss.ts';

test('payment ledger verifies evidence and atomically confirms entries', async (t) => {
  const db = new PGlite();
  const base = Date.parse('2026-09-15T00:00:00Z');
  let current = base;
  const now = () => new Date(current);
  let remoteEvents = [];
  let confirmationFailure = false;
  const confirmations = [];
  // Test provider, not a Toss adapter. Production provider is deliberately null.
  const sign = (bytes) => createHmac('sha256', 'local-test-key').update(bytes).digest('hex');
  const provider = { id: 'fixture', merchantAccount: 'test-merchant', liveMode: false,
    confirmationReplayWindowMs: 15 * 86400000,
    async confirm(order, paymentKey, key) {
      confirmations.push({ order, paymentKey, key });
      if (confirmationFailure) throw new EntryFault('PAYMENT_UNAVAILABLE', 503);
      return event(order, { paymentId: paymentKey, eventId: `confirmation-${key}` });
    },
    async verifyWebhook(bytes, headers) {
      const signature = Buffer.from(headers.get('x-test-signature') ?? '', 'hex');
      const expected = Buffer.from(sign(bytes), 'hex');
      if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new EntryFault('FORBIDDEN', 403);
      return JSON.parse(Buffer.from(bytes).toString('utf8'));
    },
    async reconcile() { return remoteEvents; },
  };
  const service = createPaymentService(db, provider, now);
  const entries = createEntryRepository(db, now);
  const handlers = createPaymentHandlers({ service, now, origin: 'https://gyca.test', getUserId: async (r) => r.headers.get('x-test-user') });
  const req = (body, extra = {}, query = '') => new Request(`https://gyca.test/${query}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-test-user': 'alice', 'idempotency-key': randomUUID(), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const event = (order, overrides = {}) => ({ eventId: randomUUID(), paymentId: randomUUID(), orderId: order.id,
    merchantAccount: provider.merchantAccount, liveMode: false, state: 'succeeded', amountMinor: 7000,
    currency: 'EUR', paidAt: new Date(base + 1000).toISOString(), ...overrides });
  async function deliver(evidence, headers = {}) {
    const body = JSON.stringify(evidence);
    return handlers.webhook(new Request('https://gyca.test/webhook', { method: 'POST', body,
      headers: { 'x-test-signature': sign(body), ...headers } }));
  }
  async function fixture(deadline = base + 60000, extra = {}) {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at) VALUES($1,'alice','test','submitted',$2)`,
      [id, new Date(base - 1000)]);
    const snapshot = { work: extra.work ?? {}, competition: { payment_closes_at: new Date(deadline).toISOString(),
      public_content: { fee: { amountMinor: 7000, currency: 'EUR' }, ...(extra.title ? { title: extra.title } : {}) } } };
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'submit','hash',$2,$3::jsonb,'{}')`,
      [id, new Date(base - 1000), JSON.stringify(snapshot)]);
    return id;
  }
  async function order() {
    const id = await fixture();
    return service.create('alice', id, randomUUID());
  }
  t.beforeEach(() => { current = base; remoteEvents = []; confirmationFailure = false; confirmations.length = 0; });
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'),(\'bob\');');
    for (const name of ['001_entries', '002_competitions', '003_uploads', '004_submissions', '005_payments', '006_payment_confirmations', '031_refunds'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.query(`INSERT INTO gyca_competitions(id,slug,payment_enabled,payment_policy) VALUES('test','test',true,$1::jsonb)`,
      [JSON.stringify({ version: 'fixture-v1', approvalBasis: 'provider_paid_at' })]);

    await t.test('creates one order per submission across keys and concurrent requests', async () => {
      const id = await fixture();
      const results = await Promise.all([service.create('alice', id, 'same-key'), service.create('alice', id, 'same-key'), service.create('alice', id, 'other-key')]);
      assert.equal(new Set(results.map((r) => r.id)).size, 1);
      assert.deepEqual(results[0].money, { amountMinor: 7000, currency: 'EUR' });
      assert.equal((await db.query('SELECT * FROM gyca_orders WHERE entry_id=$1', [id])).rows.length, 1);
    });
    await t.test('uses frozen fee and deadline even when the public competition changes', async () => {
      const id = await fixture();
      await db.query(`UPDATE gyca_competitions SET public_content='{"fee":{"amountMinor":9900,"currency":"EUR"}}',payment_closes_at='2030-01-01Z'`);
      const result = await service.create('alice', id, randomUUID());
      assert.equal(result.money.amountMinor, 7000);
      assert.equal(result.paymentClosesAtExclusive, new Date(base + 60000).toISOString());
    });
    await t.test('rejects price tampering, unowned entries and reused key for another entry', async () => {
      const id = await fixture();
      assert.equal((await handlers.create(req({ amountMinor: 1 }), id)).status, 422);
      assert.equal((await handlers.create(req({}, { 'x-test-user': 'bob' }), id)).status, 404);
      assert.equal((await handlers.create(req({}, { origin: 'https://evil.test' }), id)).status, 403);
      await assert.rejects(service.create('alice', id, 'same-key'), { code: 'IDEMPOTENCY_CONFLICT' });
    });
    await t.test('blocks order creation at the exclusive payment deadline', async () => {
      const id = await fixture(); current = base + 60000;
      await assert.rejects(service.create('alice', id, randomUUID()), { code: 'DEADLINE_PASSED' });
    });
    await t.test('keeps disabled providers and unconfigured policies closed', async () => {
      const id = await fixture();
      await assert.rejects(createPaymentService(db, null, now).create('alice', id, 'disabled'), { code: 'PAYMENT_UNAVAILABLE' });
      await db.query('UPDATE gyca_competitions SET payment_policy=NULL');
      await assert.rejects(service.create('alice', id, 'unset'), { code: 'POLICY_NOT_CONFIGURED' });
      await db.query(`UPDATE gyca_competitions SET payment_policy='{"version":"fixture-v1","approvalBasis":"provider_paid_at"}'`);
    });
    await t.test('does not trust an unsigned webhook or a browser success claim', async () => {
      const o = await order(); current += 2000;
      assert.equal((await deliver(event(o), { 'x-test-signature': '00' })).status, 403);
      assert.equal((await handlers.reconcile(req({ state: 'succeeded' }), o.id)).status, 422);
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, null);
    });
    await t.test('limits raw webhook bytes before processing', async () => {
      const response = await handlers.webhook(new Request('https://gyca.test/', { method: 'POST', body: 'x'.repeat(262145) }));
      assert.equal(response.status, 413);
    });
    await t.test('separates merchant accounts and test/live evidence', async () => {
      const o = await order(); current += 2000;
      assert.equal((await deliver(event(o, { merchantAccount: 'different' }))).status, 403);
      assert.equal((await deliver(event(o, { liveMode: true }))).status, 403);
      assert.equal((await service.get('alice', o.id)).state, 'pending');
    });
    await t.test('quarantines mismatched amount or currency instead of confirming receipt', async () => {
      for (const wrong of [{ amountMinor: 6999 }, { currency: 'USD' }]) {
        current = base;
        const o = await order(); current += 2000;
        assert.equal((await deliver(event(o, wrong))).status, 200);
        const result = await service.get('alice', o.id);
        assert.equal(result.needsReview, true); assert.deepEqual(result.allowedActions, []);
        assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'submitted');
      }
    });
    await t.test('confirms once with one receipt and one durable notification job', async () => {
      const o = await order(); current += 2000; const evidence = event(o);
      const responses = await Promise.all([deliver(evidence), deliver(evidence)]);
      assert.deepEqual(responses.map((r) => r.status), [200, 200]);
      const received = await entries.get('alice', o.entryId);
      assert.equal(received.entryStatus, 'received'); assert.equal(received.payment.state, 'succeeded');
      assert.ok(received.receiptNumber); assert.equal(received.receivedAt, now().toISOString());
      assert.deepEqual(received.blockingReasons, []);
      assert.equal((await db.query('SELECT * FROM gyca_payment_events WHERE order_id=$1', [o.id])).rows.length, 1);
      assert.equal((await db.query("SELECT * FROM gyca_payment_outbox WHERE order_id=$1 AND kind='entry_received'", [o.id])).rows.length, 1);
      await deliver({ ...evidence, eventId: randomUUID() });
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, received.receiptNumber);
      const regression = event(o, { state: 'failed', paidAt: null });
      await deliver(regression);
      assert.equal((await service.get('alice', o.id)).state, 'succeeded');
      await assert.rejects(db.query("UPDATE gyca_orders SET state='failed',provider_payment_id=NULL,paid_at=NULL WHERE id=$1", [o.id]), /regress/);
      await assert.rejects(db.query('UPDATE gyca_orders SET amount_minor=1 WHERE id=$1', [o.id]), /immutable/);
      await assert.rejects(db.query("UPDATE gyca_entries SET receipt_number='changed' WHERE id=$1", [o.entryId]), /immutable/);
    });
    await t.test('detects a changed payload under the same event identity', async () => {
      const o = await order(); current += 2000; const evidence = event(o);
      await deliver(evidence);
      assert.equal((await deliver({ ...evidence, amountMinor: 1 })).status, 409);
    });
    await t.test('records a second successful charge without issuing a second receipt', async () => {
      const o = await order(); current += 2000;
      await deliver(event(o)); const receipt = (await entries.get('alice', o.entryId)).receiptNumber;
      await deliver(event(o));
      assert.equal((await service.get('alice', o.id)).needsReview, true);
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, receipt);
      assert.deepEqual((await entries.get('alice', o.entryId)).blockingReasons, []);
      assert.equal((await db.query("SELECT * FROM gyca_payment_outbox WHERE order_id=$1 AND kind='payment_review'", [o.id])).rows.length, 1);
    });
    await t.test('recovers a timely payment from a delayed notification under provider-time policy', async () => {
      const o = await order(); current = base + 120000;
      await deliver(event(o));
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('prevents a provider payment identity from confirming two orders', async () => {
      const a = await order(); const b = await order(); current += 2000;
      const first = event(a); await deliver(first);
      await deliver(event(b, { paymentId: first.paymentId }));
      assert.equal((await entries.get('alice', b.entryId)).entryStatus, 'submitted');
      assert.equal((await service.get('alice', b.id)).needsReview, true);
    });
    await t.test('recovers a verified success after a previous failure observation', async () => {
      const o = await order(); current += 2000;
      await deliver(event(o, { state: 'failed', paidAt: null }));
      await deliver(event(o));
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('records paid but unconfirmed when approval occurs at the cutoff', async () => {
      const o = await order(); current = base + 120000;
      await deliver(event(o, { paidAt: new Date(base + 60000).toISOString() }));
      assert.equal((await service.get('alice', o.id)).state, 'succeeded');
      assert.equal((await service.get('alice', o.id)).needsReview, true);
      const entry = await entries.get('alice', o.entryId);
      assert.equal(entry.entryStatus, 'submitted'); assert.equal(entry.receiptNumber, null);
      assert.ok(!entry.allowedActions.includes('start_payment'));
    });
    await t.test('honors an explicitly configured server-verification deadline', async () => {
      await db.query(`UPDATE gyca_competitions SET payment_policy='{"version":"fixture-server","approvalBasis":"server_verified_at"}'`);
      const o = await order(); current = base + 120000;
      await deliver(event(o));
      assert.equal((await service.get('alice', o.id)).needsReview, true);
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'submitted');
      await db.query(`UPDATE gyca_competitions SET payment_policy='{"version":"fixture-v1","approvalBasis":"provider_paid_at"}'`);
    });
    await t.test('rolls back approval, receipt and event if a durable job cannot be written', async () => {
      const o = await order(); current += 2000; const evidence = event(o);
      await db.exec(`CREATE FUNCTION fail_outbox_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END; $$;
        CREATE TRIGGER fail_test BEFORE INSERT ON gyca_payment_outbox FOR EACH ROW EXECUTE FUNCTION fail_outbox_test();`);
      assert.equal((await deliver(evidence)).status, 500);
      assert.equal((await service.get('alice', o.id)).state, 'pending');
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, null);
      assert.equal((await db.query('SELECT * FROM gyca_payment_events WHERE order_id=$1', [o.id])).rows.length, 0);
      await db.exec('DROP TRIGGER fail_test ON gyca_payment_outbox; DROP FUNCTION fail_outbox_test();');
      assert.equal((await deliver(evidence)).status, 200);
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('reconciles against the provider and enforces owner boundaries and cooldown', async () => {
      const o = await order(); current += 2000; remoteEvents = [event(o)];
      assert.equal((await handlers.reconcile(req({}, { 'x-test-user': 'bob' }), o.id)).status, 404);
      assert.equal((await handlers.get(req(undefined, { 'x-test-user': '' }), o.id)).status, 401);
      assert.equal((await handlers.reconcile(req({}), o.id)).status, 200);
      assert.equal((await service.get('alice', o.id)).state, 'succeeded');
      assert.equal((await handlers.reconcile(req({}), o.id)).status, 429);
    });
    await t.test('does not apply reconciliation to a different order', async () => {
      const a = await order(); const b = await order(); current += 2000; remoteEvents = [event(b)];
      assert.equal((await handlers.reconcile(req({}), a.id)).status, 403);
      assert.equal((await service.get('alice', b.id)).state, 'pending');
    });
    await t.test('paginates only the current owners order history', async () => {
      const response = await handlers.list(req(undefined, {}, '?limit=2'));
      const data = (await response.json()).data;
      assert.equal(data.items.length, 2); assert.ok(data.nextCursor);
      const next = (await (await handlers.list(req(undefined, {}, `?limit=2&cursor=${data.nextCursor}`))).json()).data;
      assert.ok(!next.items.some((o) => data.items.some((p) => p.id === o.id)));
      assert.deepEqual((await (await handlers.list(req(undefined, { 'x-test-user': 'bob' }))).json()).data.items, []);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    });
    await t.test('order history returns frozen display summaries while order detail keeps the payment contract', async () => {
      const title = { en: 'Frozen Competition', ko: '동결 공모전' };
      const id = await fixture(base + 60000, { title, work: { title: '원제', englishTitle: 'Frozen Work' } });
      const created = await service.create('alice', id, randomUUID());
      await db.query("UPDATE gyca_competitions SET public_content=$1 WHERE id='test'", [{ title: { en: 'Changed', ko: '변경됨' } }]);
      const response = await handlers.list(req(undefined, {}, '?limit=50'));
      const item = (await response.json()).data.items.find(candidate => candidate.id === created.id);
      assert.deepEqual(item, { id: created.id, entryId: id, competitionTitle: title, workTitle: 'Frozen Work', kind: 'entry_fee',
        money: { amountMinor: 7000, currency: 'EUR' }, paymentState: 'pending', createdAt: new Date(base).toISOString(), refundSummary: null });
      const detail = await service.get('alice', created.id);
      assert.equal(detail.state, 'pending'); assert.equal(detail.paymentClosesAtExclusive, new Date(base + 60000).toISOString());
      assert.equal('competitionTitle' in detail, false);
    });
    await t.test('confirms with one durable idempotency key across concurrent HTTP requests', async () => {
      const o = await order(); current += 2000;
      const responses = await Promise.all([handlers.confirm(req({ paymentKey: 'bound-key' }), o.id), handlers.confirm(req({ paymentKey: 'bound-key' }), o.id)]);
      assert.deepEqual(responses.map((r) => r.status), [200, 200]);
      assert.equal(new Set(confirmations.map((c) => c.key)).size, 1);
      assert.equal((await db.query('SELECT * FROM gyca_payment_confirmations WHERE order_id=$1', [o.id])).rows.length, 1);
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
      assert.equal((await handlers.confirm(req({ paymentKey: 'different-key' }), o.id)).status, 409);
    });
    await t.test('preserves the confirmation key after an ambiguous provider failure', async () => {
      const o = await order(); current += 2000; confirmationFailure = true;
      assert.equal((await handlers.confirm(req({ paymentKey: 'retry-key' }), o.id)).status, 503);
      const firstKey = confirmations[0].key;
      confirmationFailure = false;
      assert.equal((await handlers.confirm(req({ paymentKey: 'retry-key' }), o.id)).status, 200);
      assert.equal(confirmations[1].key, firstKey);
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('switches an ambiguous confirmation to lookup-only after the deadline', async () => {
      const o = await order(); current += 2000; confirmationFailure = true;
      await handlers.confirm(req({ paymentKey: 'late-key' }), o.id);
      current = base + 120000; remoteEvents = [event(o, { paymentId: 'late-key' })];
      assert.equal((await handlers.confirm(req({ paymentKey: 'late-key' }), o.id)).status, 200);
      assert.equal(confirmations.length, 1);
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('late confirmation lookup shares cooldown with reconciliation', async () => {
      const o = await order(); current += 2000; confirmationFailure = true;
      await handlers.confirm(req({ paymentKey: 'cooldown-key' }), o.id);
      current = base + 120000;
      let calls = 0;
      const countingProvider = { ...provider, reconcile: async () => { calls++; return []; } };
      const lateService = createPaymentService(db, countingProvider, now);
      assert.equal((await lateService.confirm('alice', o.id, 'cooldown-key')).state, 'pending');
      await assert.rejects(lateService.confirm('alice', o.id, 'cooldown-key'), { code: 'RATE_LIMITED' });
      await assert.rejects(lateService.reconcile('alice', o.id), { code: 'RATE_LIMITED' });
      assert.equal(calls, 1); assert.equal(confirmations.length, 1);
      current += 10000;
      await lateService.confirm('alice', o.id, 'cooldown-key');
      assert.equal(calls, 2);
    });
    await t.test('never reissues an approval after the providers 15-day idempotency window', async () => {
      const id = await fixture(base + 30 * 86400000);
      const o = await service.create('alice', id, randomUUID());
      current += 2000; confirmationFailure = true;
      await handlers.confirm(req({ paymentKey: 'old-key' }), o.id);
      current += 15 * 86400000; remoteEvents = [event(o, { paymentId: 'old-key' })];
      assert.equal((await handlers.confirm(req({ paymentKey: 'old-key' }), o.id)).status, 200);
      assert.equal(confirmations.length, 1);
    });
    await t.test('switches to lookup when replay window expires between reservation and outbound call', async () => {
      const id = await fixture(base + 30 * 86400000);
      const o = await service.create('alice', id, randomUUID());
      current += 2000; confirmationFailure = true;
      await handlers.confirm(req({ paymentKey: 'boundary-key' }), o.id);
      const expiry = current + 15 * 86400000;
      current = expiry - 1; confirmationFailure = false;
      let lookups = 0;
      const boundaryDb = { query: (...args) => db.query(...args), transaction: async fn => {
        const result = await db.transaction(fn); current = expiry; return result;
      } };
      const boundaryProvider = { ...provider, reconcile: async () => { lookups++; return [event(o, { paymentId: 'boundary-key' })]; } };
      const boundaryService = createPaymentService(boundaryDb, boundaryProvider, now);
      assert.equal((await boundaryService.confirm('alice', o.id, 'boundary-key')).state, 'succeeded');
      assert.equal(confirmations.length, 1); assert.equal(lookups, 1);
      assert.equal((await entries.get('alice', id)).entryStatus, 'received');
    });
    await t.test('validates a whole lookup response before applying events and retains cooldown on failure', async () => {
      const o = await order(); current += 2000;
      let calls = 0;
      let response = [event(o), { malformed: true }];
      const checkedProvider = { ...provider, reconcile: async () => { calls++; return response; } };
      const checked = createPaymentService(db, checkedProvider, now);
      await assert.rejects(checked.reconcile('alice', o.id));
      assert.equal((await checked.get('alice', o.id)).state, 'pending');
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, null);
      assert.equal((await db.query('SELECT * FROM gyca_payment_events WHERE order_id=$1', [o.id])).rows.length, 0);
      await assert.rejects(checked.reconcile('alice', o.id), { code: 'RATE_LIMITED' }); assert.equal(calls, 1);
      current += 10000;
      response = [event(o), event(o, { orderId: randomUUID() })];
      await assert.rejects(checked.reconcile('alice', o.id), { code: 'FORBIDDEN' });
      assert.equal((await checked.get('alice', o.id)).state, 'pending');
      current += 10000;
      response = [event(o)];
      assert.equal((await checked.reconcile('alice', o.id)).state, 'succeeded');
      assert.equal((await entries.get('alice', o.entryId)).entryStatus, 'received');
    });
    await t.test('rejects a fresh late confirmation and browser amount or identity escalation', async () => {
      const o = await order(); current += 2000;
      assert.equal((await handlers.confirm(req({ paymentKey: 'k', amountMinor: 1 }), o.id)).status, 422);
      assert.equal((await handlers.confirm(req({ paymentKey: 'k' }, { 'x-test-user': 'bob' }), o.id)).status, 404);
      assert.equal((await handlers.confirm(req({ paymentKey: 'k' }, { origin: 'https://evil.test' }), o.id)).status, 403);
      current = base + 60000;
      assert.equal((await handlers.confirm(req({ paymentKey: 'k' }), o.id)).status, 409);
      assert.equal(confirmations.length, 0);
    });
    await t.test('records provider cancellation review without erasing a previously issued receipt', async () => {
      const o = await order(); current += 2000;
      await deliver(event(o));
      const receipt = (await entries.get('alice', o.entryId)).receiptNumber;
      await deliver(event(o, { state: 'cancelled', requiresReview: true }));
      assert.equal((await service.get('alice', o.id)).needsReview, true);
      assert.equal((await entries.get('alice', o.entryId)).receiptNumber, receipt);
    });
    await t.test('connects Toss-normalized approval through the actual ledger and HTTP handler', async () => {
      const calls = [];
      const toss = createTossProvider({ secretKey: 'test_sk_fixture', merchantAccount: 'fixture', liveMode: false,
        currencyTerms: { currency: 'EUR', amountUnit: 'major', approvalReference: 'local test only' } }, async (path, body, key) => {
        calls.push({ path, body, key });
        return { status: 200, body: { paymentKey: body.paymentKey, orderId: body.orderId, mId: 'fixture', type: 'NORMAL',
          totalAmount: body.amount, currency: 'EUR', status: 'DONE', approvedAt: '2026-09-15T09:00:01+09:00', lastTransactionKey: 'transaction' } };
      });
      const tossService = createPaymentService(db, toss, now);
      const tossHandlers = createPaymentHandlers({ service: tossService, now, origin: 'https://gyca.test', getUserId: async (r) => r.headers.get('x-test-user') });
      const id = await fixture(); const o = await tossService.create('alice', id, randomUUID()); current += 2000;
      const response = await tossHandlers.confirm(req({ paymentKey: 'toss-key' }), o.id);
      assert.equal(response.status, 200);
      assert.equal(calls[0].body.amount, 70);
      const entry = await entries.get('alice', id);
      assert.equal(entry.entryStatus, 'received'); assert.equal(entry.payment.amountMinor, 7000);
    });
  } finally { await db.close(); }
});
