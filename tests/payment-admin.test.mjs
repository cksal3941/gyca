import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentAdmin } from '../src/server/payments/admin.ts';
import { createPaymentAdminHandlers } from '../src/server/payments/admin-http.ts';
import { createPaymentHealthHandler } from '../src/server/payments/health.ts';

test('competition-scoped payment administration', async (t) => {
  const db = new PGlite(); const at = new Date('2026-09-15T00:00:00Z');
  const service = createPaymentAdmin(db, () => new Date(at.getTime() + 1000));
  const scope = { actor: 'operator', competitionId: 'one' };
  const handlers = createPaymentAdminHandlers({ service, now: () => at, origin: 'http://localhost:3000',
    getUserId: async request => request.headers.get('x-test-user') });
  const page = { cursor: null, limit: 20 };
  const input = () => ({ actionId: randomUUID(), reason: 'Provider outage resolved', expectedUpdatedAt: at.toISOString() });
  async function fixture(competition = 'one', review = false, state = 'stalled') {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,participant)
      VALUES($1,'participant',$2,'submitted',$3,'{"name":"PRIVATE NAME"}')`, [id, competition, at]);
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'key','hash',$2,'{}','{}')`, [id, at]);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,
      approval_basis,provider,merchant_account,live_mode,needs_review,created_at)
      VALUES($1,$1,7000,'EUR',$2,'test','provider_paid_at','fixture','SECRET MID',false,$3,$2)`, [id, at, review]);
    await db.query(`INSERT INTO gyca_payment_recovery(order_id,state,attempts,due_at,updated_at)
      VALUES($1,$2,12,$3,$3)`, [id, state, at]);
    return id;
  }
  async function lateFixture() {
    const id = await fixture('one', true, 'completed'); const reviewedAt = new Date(at.getTime() + 1000);
    const evidence = { eventId: `late-${id}`, paymentId: `payment-${id}`, orderId: id,
      merchantAccount: 'SECRET MID', liveMode: false, state: 'succeeded', amountMinor: 7000, currency: 'EUR', paidAt: at.toISOString() };
    await db.query("UPDATE gyca_orders SET state='succeeded',provider_payment_id=$2,paid_at=$3 WHERE id=$1", [id, evidence.paymentId, at]);
    await db.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
      VALUES('fixture','SECRET MID',false,$4,'hash',$1,$2,$3,'review')`, [id, evidence, reviewedAt, evidence.eventId]);
    return { id, reviewedAt };
  }
  t.beforeEach(async () => {
    await db.exec('TRUNCATE gyca_entries CASCADE; DELETE FROM gyca_payment_permissions');
    await db.exec(`INSERT INTO gyca_payment_permissions VALUES('operator','one','operator'),('viewer','one','viewer')`);
  });
  try {
    await db.exec(`CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES('participant'),('operator'),('viewer')`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','006_payment_confirmations','007_payment_recovery','008_payment_admin','030_late_payment_acceptance'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('one','one'),('two','two')`);
    await t.test('anonymous is 401 and participant is 403; never trusts demo role', async () => {
      for (const [actor, status] of [[null, 401], ['participant', 403], ['admin@gyca.org', 403]]) {
        const response = await handlers.list(new Request('http://localhost:3000/api', { headers: actor ? { 'x-test-user': actor } : {} }), 'one');
        assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      }
    });
    await t.test('bounded scoped list excludes ordinary orders and private fields', async () => {
      const ids = [await fixture(), await fixture('one', true)].sort();
      await fixture('two'); await fixture('one', false, 'pending');
      const first = await service.list(scope, { ...page, limit: 1 });
      assert.equal(first.items[0].orderId, ids[0]); assert.equal(first.nextCursor, ids[0]);
      const second = await service.list(scope, { limit: 1, cursor: first.nextCursor });
      assert.equal(second.items[0].orderId, ids[1]); assert.equal(second.nextCursor, null);
      assert.doesNotMatch(JSON.stringify(first), /PRIVATE NAME|SECRET MID|owner_id|payment_key/);
      const viewer = await service.list({ ...scope, actor: 'viewer' }, page);
      assert.ok(viewer.items.every(item => item.allowedActions.length === 0));
      assert.deepEqual(viewer.items.find(item => item.needsReview).reviewReasons, ['LEGACY_UNKNOWN']);
      await assert.rejects(service.list({ ...scope, competitionId: 'two' }, page), { code: 'FORBIDDEN' });
    });
    await t.test('review reasons are derived from immutable verified evidence without exposing provider data', async () => {
      const id = await fixture('one', true, 'completed');
      const evidence = { eventId: 'review-reason', paymentId: 'PRIVATE PAYMENT KEY', orderId: id,
        merchantAccount: 'SECRET MID', liveMode: false, state: 'succeeded', amountMinor: 1, currency: 'USD',
        paidAt: new Date(at.getTime() + 1000).toISOString(), requiresReview: true };
      await db.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
        VALUES('fixture','SECRET MID',false,'review-reason','hash',$1,$2,$3,'review')`, [id, evidence, at]);
      const detail = await service.detail(scope, id);
      assert.deepEqual(detail.reviewReasons, ['AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'PROVIDER_REVIEW_REQUIRED']);
      assert.doesNotMatch(JSON.stringify(detail), /PRIVATE PAYMENT KEY|SECRET MID|review-reason/);
    });
    await t.test('temporal review reports the first payment validation boundary', async () => {
      const id = await fixture('one', true, 'completed');
      const evidence = { eventId: 'future-payment', paymentId: 'private-future-key', orderId: id,
        merchantAccount: 'SECRET MID', liveMode: false, state: 'succeeded', amountMinor: 7000, currency: 'EUR',
        paidAt: new Date(at.getTime() + 1000).toISOString() };
      await db.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
        VALUES('fixture','SECRET MID',false,'future-payment','hash',$1,$2,$3,'review')`, [id, evidence, at]);
      assert.deepEqual((await service.detail(scope, id)).reviewReasons, ['PAID_AT_AFTER_VERIFICATION']);
    });
    await t.test('operator accepts only an otherwise valid payment approved at the deadline and issues one receipt', async () => {
      const { id, reviewedAt } = await lateFixture();
      const detail = await service.detail(scope, id);
      assert.deepEqual(detail.reviewReasons, ['APPROVED_AFTER_DEADLINE']);
      assert.equal(detail.reviewedAt, reviewedAt.toISOString());
      assert.deepEqual(detail.allowedActions, ['accept_late_payment']);
      assert.deepEqual((await service.detail({ ...scope, actor: 'viewer' }, id)).allowedActions, []);
      const request = { actionId: randomUUID(), reason: 'Verified provider approval at the exact cutoff',
        expectedReviewedAt: detail.reviewedAt };
      await assert.rejects(service.acceptLatePayment({ ...scope, actor: 'viewer' }, id, request), { code: 'FORBIDDEN' });
      await assert.rejects(service.acceptLatePayment(scope, id, { ...request, expectedReviewedAt: at.toISOString() }),
        { code: 'REVISION_CONFLICT' });
      const result = await service.acceptLatePayment(scope, id, request);
      assert.equal(result.outcome, 'receipt_issued'); assert.equal(result.entryId, id); assert.ok(result.receiptNumber);
      assert.deepEqual(await service.acceptLatePayment(scope, id, request), result);
      await assert.rejects(service.acceptLatePayment(scope, id, { ...request, reason: 'changed' }), { code: 'IDEMPOTENCY_CONFLICT' });
      assert.deepEqual((await db.query('SELECT state,needs_review FROM gyca_orders WHERE id=$1', [id])).rows[0],
        { state: 'succeeded', needs_review: false });
      const entry = (await db.query('SELECT status,receipt_number FROM gyca_entries WHERE id=$1', [id])).rows[0];
      assert.deepEqual(entry, { status: 'received', receipt_number: result.receiptNumber });
      assert.equal((await db.query("SELECT count(*)::int AS n FROM gyca_payment_outbox WHERE kind='entry_received' AND order_id=$1", [id])).rows[0].n, 1);
      const history = await service.history(scope, { ...page, orderId: id });
      assert.equal(history.items[0].action, 'accept_late_payment');
      assert.doesNotMatch(JSON.stringify(result), /payment-|SECRET MID|late-/);
    });
    await t.test('unsafe review reasons cannot issue a receipt', async () => {
      const id = await fixture('one', true, 'completed');
      const evidence = { eventId: 'bad-amount', paymentId: 'private-key', orderId: id, merchantAccount: 'SECRET MID',
        liveMode: false, state: 'succeeded', amountMinor: 1, currency: 'EUR', paidAt: at.toISOString() };
      await db.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
        VALUES('fixture','SECRET MID',false,'bad-amount','hash',$1,$2,$3,'review')`, [id, evidence, at]);
      const detail = await service.detail(scope, id);
      assert.deepEqual(detail.reviewReasons, ['AMOUNT_MISMATCH']); assert.deepEqual(detail.allowedActions, []);
      await assert.rejects(service.acceptLatePayment(scope, id, { actionId: randomUUID(), reason: 'must remain blocked',
        expectedReviewedAt: detail.reviewedAt }), { code: 'REVISION_CONFLICT' });
      assert.equal((await db.query('SELECT receipt_number FROM gyca_entries WHERE id=$1', [id])).rows[0].receipt_number, null);
    });
    await t.test('later review evidence removes late-payment acceptance', async () => {
      const { id, reviewedAt } = await lateFixture();
      const later = { eventId: `later-${id}`, paymentId: `payment-${id}`, orderId: id, merchantAccount: 'SECRET MID',
        liveMode: false, state: 'succeeded', amountMinor: 7000, currency: 'EUR', paidAt: at.toISOString(), requiresReview: true };
      await db.query(`INSERT INTO gyca_payment_events(provider,merchant_account,live_mode,event_id,event_hash,order_id,evidence,verified_at,outcome)
        VALUES('fixture','SECRET MID',false,$4,'hash-2',$1,$2,$3,'review')`,
        [id, later, new Date(reviewedAt.getTime() + 1000), later.eventId]);
      const detail = await service.detail(scope, id);
      assert.deepEqual(detail.reviewReasons, ['APPROVED_AFTER_DEADLINE']); assert.deepEqual(detail.allowedActions, []);
      await assert.rejects(service.acceptLatePayment(scope, id, { actionId: randomUUID(), reason: 'must inspect later evidence',
        expectedReviewedAt: reviewedAt.toISOString() }), { code: 'REVISION_CONFLICT' });
    });
    await t.test('detail remains available after requeue, excludes private fields and enforces scope', async () => {
      const id = await fixture();
      assert.deepEqual((await service.detail(scope, id)).allowedActions, ['requeue_recovery']);
      await service.requeue(scope, id, input());
      assert.equal((await service.list(scope, page)).items.length, 0);
      const detail = await service.detail(scope, id);
      assert.equal(detail.orderId, id); assert.equal(detail.recovery.state, 'pending');
      assert.deepEqual(detail.allowedActions, []);
      assert.doesNotMatch(JSON.stringify(detail), /PRIVATE NAME|SECRET MID|owner_id|payment_key/);
      await db.query('DELETE FROM gyca_payment_recovery WHERE order_id=$1', [id]);
      assert.equal((await service.detail(scope, id)).recovery, null);
      const foreign = await fixture('two');
      const get = (actor, orderId = id) => handlers.detail(new Request('http://localhost:3000/api', {
        headers: actor ? { 'x-test-user': actor } : {},
      }), { competitionId: 'one', orderId });
      for (const [actor, status] of [[null, 401], ['participant', 403], ['viewer', 200]]) {
        const response = await get(actor); assert.equal(response.status, status);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
      }
      assert.equal((await get('viewer', foreign)).status, 404);
      assert.equal((await get('viewer', randomUUID())).status, 404);
      assert.equal((await get('viewer', 'invalid')).status, 422);
      await db.query("DELETE FROM gyca_payment_permissions WHERE user_id='viewer'");
      assert.equal((await get('viewer')).status, 403);
    });
    await t.test('recovery diagnostics show state-specific timing and only approved error codes', async () => {
      const id = await fixture();
      await db.query("UPDATE gyca_payment_recovery SET last_error_code='PAYMENT_UNAVAILABLE' WHERE order_id=$1", [id]);
      const stalled = await service.detail(scope, id);
      assert.equal(stalled.recovery.lastErrorCode, 'PAYMENT_UNAVAILABLE');
      assert.equal(stalled.recovery.nextAttemptAt, null);
      assert.equal(stalled.recovery.leaseExpiresAt, null);
      await service.requeue(scope, id, input());
      const pending = await service.detail(scope, id);
      assert.equal(pending.recovery.lastErrorCode, null);
      assert.equal(pending.recovery.nextAttemptAt, new Date(at.getTime() + 1000).toISOString());
      const lease = new Date(at.getTime() + 120000);
      await db.query("UPDATE gyca_payment_recovery SET state='running',lease_token=$2,lease_until=$3,last_error_code='PRIVATE PROVIDER ERROR' WHERE order_id=$1", [id, randomUUID(), lease]);
      const running = await service.detail(scope, id);
      assert.equal(running.recovery.nextAttemptAt, null);
      assert.equal(running.recovery.leaseExpiresAt, lease.toISOString());
      assert.equal(running.recovery.lastErrorCode, 'INTERNAL_ERROR');
      assert.doesNotMatch(JSON.stringify(running), /PRIVATE PROVIDER|lease_token/);
      await db.query("UPDATE gyca_payment_recovery SET state='completed',lease_token=NULL,lease_until=NULL WHERE order_id=$1", [id]);
      const completed = await service.detail(scope, id);
      assert.equal(completed.recovery.nextAttemptAt, null); assert.equal(completed.recovery.leaseExpiresAt, null);
    });
    await t.test('payment health counts scoped jobs at due and lease boundaries without leaking orders', async () => {
      const handler = createPaymentHealthHandler({ database: db, now: () => at, origin: 'http://localhost:3000', getUserId: async request => request.headers.get('x-test-user') });
      const get = (actor, competition = 'one') => handler(new Request('http://localhost:3000/api', { headers: actor ? { 'x-test-user': actor } : {} }), competition);
      assert.equal((await get(null)).status, 401); assert.equal((await get('participant')).status, 403);
      assert.equal((await get('viewer', 'two')).status, 403);
      const empty = (await (await get('viewer')).json()).data;
      assert.equal(empty.orders.total, 0); assert.equal(empty.recovery.oldestDueAt, null);
      await fixture('one', true); await fixture('two');
      await fixture('one', false, 'pending');
      const future = await fixture('one', false, 'pending');
      await db.query('UPDATE gyca_payment_recovery SET due_at=$2 WHERE order_id=$1', [future, new Date(at.getTime() + 1)]);
      const running = await fixture('one', false, 'pending');
      await db.query("UPDATE gyca_payment_recovery SET state='running',lease_token=$2,lease_until=$3 WHERE order_id=$1", [running, randomUUID(), at]);
      const response = await get('viewer'); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const result = (await response.json()).data;
      assert.deepEqual(result, { competitionId: 'one', measuredAt: at.toISOString(),
        orders: { total: 4, pending: 4, succeeded: 0, failed: 0, cancelled: 0, expired: 0, needsReview: 1 },
        recovery: { pending: 2, running: 1, completed: 0, stalled: 1, due: 1, expiredLeases: 1, oldestDueAt: at.toISOString() } });
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE|SECRET|owner_id|lease_token/);
      await db.query("DELETE FROM gyca_payment_permissions WHERE user_id='viewer'");
      assert.equal((await get('viewer')).status, 403);
    });
    await t.test('requeue writes immutable actor audit, resets attempts and does not change receipt/payment', async () => {
      const id = await fixture(); const request = input();
      const before = (await service.list(scope, page)).items[0];
      assert.deepEqual(before.allowedActions, ['requeue_recovery']);
      assert.deepEqual(await service.requeue(scope, id, request), { actionId: request.actionId, outcome: 'recovery_queued' });
      assert.deepEqual((await db.query('SELECT state,attempts FROM gyca_payment_recovery WHERE order_id=$1', [id])).rows[0], { state: 'pending', attempts: 0 });
      assert.deepEqual((await db.query('SELECT state,needs_review FROM gyca_orders WHERE id=$1', [id])).rows[0], { state: 'pending', needs_review: false });
      assert.equal((await db.query('SELECT receipt_number FROM gyca_entries WHERE id=$1', [id])).rows[0].receipt_number, null);
      const audit = (await db.query('SELECT actor_id,reason FROM gyca_payment_admin_actions')).rows;
      assert.deepEqual(audit, [{ actor_id: 'operator', reason: request.reason }]);
      await assert.rejects(db.query('UPDATE gyca_payment_admin_actions SET reason=$1', ['changed']), /immutable/);
      await assert.rejects(db.query('DELETE FROM gyca_payment_admin_actions'), /immutable/);
    });
    await t.test('replay is idempotent and changed payload conflicts', async () => {
      const id = await fixture(); const request = input();
      const result = await service.requeue(scope, id, request);
      assert.deepEqual(await service.requeue(scope, id, request), result);
      await assert.rejects(service.requeue(scope, id, { ...request, reason: 'different' }), { code: 'IDEMPOTENCY_CONFLICT' });
      assert.equal((await db.query('SELECT * FROM gyca_payment_admin_actions')).rows.length, 1);
    });
    await t.test('audit remains readable after a case leaves the review list and respects scope', async () => {
      const id = await fixture(); await service.requeue(scope, id, input());
      assert.equal((await service.list(scope, page)).items.length, 0);
      const history = await service.history({ ...scope, actor: 'viewer' }, { ...page, orderId: id });
      assert.equal(history.items[0].actorId, 'operator'); assert.equal(history.items[0].action, 'requeue_recovery');
      assert.equal(history.nextCursor, null);
      await assert.rejects(service.history({ ...scope, actor: 'participant' }, { ...page, orderId: id }), { code: 'FORBIDDEN' });
      await assert.rejects(service.history(scope, { ...page, orderId: await fixture('two') }), { code: 'NOT_FOUND' });
      const response = await handlers.history(new Request('http://localhost:3000/api', { headers: { 'x-test-user': 'viewer' } }), { competitionId: 'one', orderId: id });
      assert.equal(response.status, 200);
    });
    await t.test('viewer, revoked permission and wrong competition cannot mutate', async () => {
      const id = await fixture(); const foreign = await fixture('two');
      await assert.rejects(service.requeue({ ...scope, actor: 'viewer' }, id, input()), { code: 'FORBIDDEN' });
      await assert.rejects(service.requeue(scope, foreign, input()), { code: 'NOT_FOUND' });
      await db.query('DELETE FROM gyca_payment_permissions WHERE user_id=$1', ['operator']);
      await assert.rejects(service.requeue(scope, id, input()), { code: 'FORBIDDEN' });
    });
    await t.test('review flag, completed payment, changed version and non-stalled job refuse requeue', async () => {
      const review = await fixture('one', true); const pending = await fixture('one', false, 'pending');
      const paid = await fixture(); const stale = await fixture();
      await db.query(`UPDATE gyca_orders SET state='succeeded',paid_at=$2,provider_payment_id=$1 WHERE id=$1`, [paid, at]);
      for (const id of [review, pending, paid]) await assert.rejects(service.requeue(scope, id, input()), { code: 'REVISION_CONFLICT' });
      await assert.rejects(service.requeue(scope, stale, { ...input(), expectedUpdatedAt: '2026-09-14T00:00:00Z' }), { code: 'REVISION_CONFLICT' });
      assert.equal((await db.query('SELECT * FROM gyca_payment_admin_actions')).rows.length, 0);
    });
    await t.test('audit failure rolls back queue mutation', async () => {
      const id = await fixture();
      const failing = { transaction: run => db.transaction(tx => run({ query: (sql, values) => {
        if (sql.includes('INSERT INTO gyca_payment_admin_actions')) throw new Error('injected audit failure');
        return tx.query(sql, values);
      } })) };
      await assert.rejects(createPaymentAdmin(failing, () => at).requeue(scope, id, input()), /injected/);
      assert.equal((await db.query('SELECT state FROM gyca_payment_recovery WHERE order_id=$1', [id])).rows[0].state, 'stalled');
    });
    await t.test('late acceptance audit failure rolls back receipt, review flag and notification', async () => {
      const { id, reviewedAt } = await lateFixture();
      const failing = { transaction: run => db.transaction(tx => run({ query: (sql, values) => {
        if (sql.includes('INSERT INTO gyca_payment_admin_actions')) throw new Error('injected audit failure');
        return tx.query(sql, values);
      } })) };
      const request = { actionId: randomUUID(), reason: 'late payment review', expectedReviewedAt: reviewedAt.toISOString() };
      await assert.rejects(createPaymentAdmin(failing, () => at).acceptLatePayment(scope, id, request), /injected/);
      assert.equal((await db.query('SELECT needs_review FROM gyca_orders WHERE id=$1', [id])).rows[0].needs_review, true);
      assert.equal((await db.query('SELECT receipt_number FROM gyca_entries WHERE id=$1', [id])).rows[0].receipt_number, null);
      assert.equal((await db.query("SELECT count(*)::int AS n FROM gyca_payment_outbox WHERE kind='entry_received' AND order_id=$1", [id])).rows[0].n, 0);
    });
    await t.test('HTTP enforces origin, strict input and page limits', async () => {
      const id = await fixture();
      const request = (body, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api', {
        method: 'POST', headers: { 'x-test-user': 'operator', origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal((await handlers.requeue(request(input(), 'https://evil.test'), { competitionId: 'one', orderId: id })).status, 403);
      assert.equal((await handlers.requeue(request({ ...input(), state: 'succeeded' }), { competitionId: 'one', orderId: id })).status, 422);
      assert.equal((await handlers.requeue(request({ ...input(), reason: ' ' }), { competitionId: 'one', orderId: id })).status, 422);
      assert.equal((await handlers.list(new Request('http://localhost:3000/api?limit=51', { headers: { 'x-test-user': 'operator' } }), 'one')).status, 422);
      assert.equal((await handlers.requeue(request(input()), { competitionId: 'one', orderId: id })).status, 200);
      const late = await lateFixture(); const lateBody = { actionId: randomUUID(), reason: 'verified late approval',
        expectedReviewedAt: late.reviewedAt.toISOString() };
      assert.equal((await handlers.acceptLatePayment(request(lateBody, 'https://evil.test'),
        { competitionId: 'one', orderId: late.id })).status, 403);
      assert.equal((await handlers.acceptLatePayment(request({ ...lateBody, amountMinor: 7000 }),
        { competitionId: 'one', orderId: late.id })).status, 422);
      assert.equal((await handlers.acceptLatePayment(request(lateBody), { competitionId: 'one', orderId: late.id })).status, 200);
    });
  } finally { await db.close(); }
});
