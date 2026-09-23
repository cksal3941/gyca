import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentRefunds } from '../src/server/payments/refunds.ts';
import { createRefundHandlers } from '../src/server/payments/refund-http.ts';
import { createPaymentService } from '../src/server/payments/service.ts';
import { EntryFault } from '../src/server/entries/errors.ts';

test('refund ledger is scoped, idempotent and never exceeds the verified payment', async (t) => {
  const db = new PGlite();
  const at = new Date('2026-09-19T00:00:00Z');
  let ambiguous = false;
  const calls = [];
  const provider = { id: 'fixture', merchantAccount: 'merchant', liveMode: false,
    verifyWebhook: async () => ({}), reconcile: async () => [],
    refund: async (order, paymentId, amountMinor, reason, key) => {
      calls.push({ orderId: order.id, paymentId, amountMinor, reason, key });
      if (ambiguous) throw new EntryFault('PAYMENT_UNAVAILABLE', 503);
      return { refundId: `refund-${key}`, orderId: order.id, paymentId, amountMinor, currency: 'EUR',
        refundedAt: new Date(at.getTime() + 1000).toISOString() };
    } };
  const refunds = createPaymentRefunds(db, [provider], () => at);
  const handlers = createRefundHandlers({ service: refunds, now: () => at, origin: 'https://gyca.test',
    getUserId: async request => request.headers.get('x-test-user') });
  async function fixture() {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number)
      VALUES($1,'participant','one','received',$2,$2,$3)`, [id, at, `GYCA-${id}`]);
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'key','hash',$2,$3::jsonb,'{}')`, [id, at, JSON.stringify({ work: { englishTitle: 'Frozen Work' },
        competition: { public_content: { title: { en: 'Frozen Competition', ko: '동결 공모전' } } } })]);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,
      provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
      VALUES($1,$1,7000,'EUR',$2,'v1','provider_paid_at','fixture','merchant',false,'succeeded',$3,$2,$2)`,
    [id, at, `payment-${id}`]);
    return id;
  }
  const request = (body, actor = 'operator', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
    method: body === undefined ? 'GET' : 'POST', headers: { 'x-test-user': actor, origin, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  try {
    await db.exec(`CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES('participant'),('operator'),('viewer');`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','008_payment_admin','031_refunds'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.query(`INSERT INTO gyca_competitions(id,slug,public_content) VALUES('one','one',$1::jsonb),('two','two','{}')`,
      [JSON.stringify({ title: { en: 'Current Competition', ko: '현재 공모전' } })]);
    await db.exec(`INSERT INTO gyca_payment_permissions VALUES('operator','one','operator'),('viewer','one','viewer')`);

    await t.test('operator performs partial refunds and participant history shows the aggregate', async () => {
      const id = await fixture();
      assert.deepEqual((await refunds.overview({ actor: 'operator', competitionId: 'one' }, id)).allowedActions, ['request_refund']);
      assert.deepEqual((await refunds.overview({ actor: 'viewer', competitionId: 'one' }, id)).allowedActions, []);
      const first = { actionId: randomUUID(), amountMinor: 3000, reason: 'Approved participant request' };
      const result = await refunds.request({ actor: 'operator', competitionId: 'one' }, id, first);
      assert.equal(result.state, 'succeeded'); assert.equal(result.money.amountMinor, 3000);
      assert.deepEqual(await refunds.request({ actor: 'operator', competitionId: 'one' }, id, first), result);
      assert.equal(calls.filter(call => call.key === first.actionId).length, 1);
      await assert.rejects(refunds.request({ actor: 'operator', competitionId: 'one' }, id,
        { ...first, amountMinor: 1 }), { code: 'IDEMPOTENCY_CONFLICT' });
      const second = { actionId: randomUUID(), amountMinor: 4000, reason: 'Refund remaining balance' };
      await refunds.request({ actor: 'operator', competitionId: 'one' }, id, second);
      const overview = await refunds.overview({ actor: 'operator', competitionId: 'one' }, id);
      assert.equal(overview.refundedAmountMinor, 7000); assert.equal(overview.remainingAmountMinor, 0);
      assert.deepEqual(overview.allowedActions, []);
      await assert.rejects(refunds.request({ actor: 'operator', competitionId: 'one' }, id,
        { actionId: randomUUID(), amountMinor: 1, reason: 'Too much' }), { code: 'REVISION_CONFLICT' });
      const summary = (await createPaymentService(db, provider, () => at).listSummaries('participant', null, 20)).items[0];
      assert.deepEqual(summary.refundSummary, { amountMinor: 7000, state: 'succeeded' });
      assert.deepEqual(summary.competitionTitle, { en: 'Frozen Competition', ko: '동결 공모전' });
    });

    await t.test('ambiguous provider failure remains pending and retries only with the same action', async () => {
      const id = await fixture(); const action = { actionId: randomUUID(), amountMinor: 2000, reason: 'Retry safely' };
      ambiguous = true;
      await assert.rejects(refunds.request({ actor: 'operator', competitionId: 'one' }, id, action), { code: 'PAYMENT_UNAVAILABLE' });
      const waiting = await refunds.overview({ actor: 'operator', competitionId: 'one' }, id);
      assert.equal(waiting.pendingAmountMinor, 2000); assert.equal(waiting.remainingAmountMinor, 5000);
      await assert.rejects(refunds.request({ actor: 'operator', competitionId: 'one' }, id,
        { actionId: randomUUID(), amountMinor: 6000, reason: 'Would exceed payment' }), { code: 'REVISION_CONFLICT' });
      ambiguous = false;
      const completed = await refunds.request({ actor: 'operator', competitionId: 'one' }, id, action);
      assert.equal(completed.state, 'succeeded');
      const matching = calls.filter(call => call.key === action.actionId);
      assert.equal(matching.length, 2); assert.ok(matching.every(call => call.amountMinor === 2000));
    });

    await t.test('missing provider capability fails closed without creating a request', async () => {
      const id = await fixture(); const unavailable = createPaymentRefunds(db, [], () => at);
      assert.deepEqual((await unavailable.overview({ actor: 'operator', competitionId: 'one' }, id)).allowedActions, []);
      await assert.rejects(unavailable.request({ actor: 'operator', competitionId: 'one' }, id,
        { actionId: randomUUID(), amountMinor: 1000, reason: 'Must not be queued' }), { code: 'PAYMENT_UNAVAILABLE' });
      assert.equal((await db.query('SELECT count(*)::int AS count FROM gyca_refunds WHERE order_id=$1', [id])).rows[0].count, 0);
    });

    await t.test('HTTP boundary enforces role, competition, origin and strict input', async () => {
      const id = await fixture(); const target = { competitionId: 'one', orderId: id };
      assert.equal((await handlers.overview(request(undefined, ''), target)).status, 401);
      assert.equal((await handlers.overview(request(undefined, 'participant'), target)).status, 403);
      assert.equal((await handlers.overview(request(undefined, 'viewer'), target)).status, 200);
      const body = { actionId: randomUUID(), amountMinor: 1000, reason: 'Authorized refund' };
      assert.equal((await handlers.request(request(body, 'operator', 'https://evil.test'), target)).status, 403);
      assert.equal((await handlers.request(request({ ...body, state: 'succeeded' }), target)).status, 422);
      assert.equal((await handlers.request(request(body, 'viewer'), target)).status, 403);
      assert.equal((await handlers.request(request(body), { competitionId: 'two', orderId: id })).status, 403);
      assert.equal((await handlers.request(request(body), target)).status, 200);
    });
  } finally { await db.close(); }
});
