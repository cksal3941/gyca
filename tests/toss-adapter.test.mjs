import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaymentService } from '../src/server/payments/service.ts';
import { createTossProvider, createTossTransport, configuredTossProvider } from '../src/server/payments/toss.ts';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';

const order = { id: '00000000-0000-4000-8000-000000000001', entryId: '00000000-0000-4000-8000-000000000002',
  kind: 'entry_fee', money: { amountMinor: 7000, currency: 'EUR' }, state: 'pending', needsReview: false,
  createdAt: '2026-09-15T00:00:00Z', paymentClosesAtExclusive: '2027-01-01T00:00:00Z',
  approvalBasis: 'provider_paid_at', policyVersion: 'test', allowedActions: [], blockingReasons: [] };
const config = { secretKey: 'test_sk_fixture', merchantAccount: 'fixture', liveMode: false,
  currencyTerms: { currency: 'EUR', amountUnit: 'major', approvalReference: 'TEST FIXTURE ONLY, NOT A MERCHANT CONTRACT' } };
const payment = { paymentKey: 'key-one', orderId: order.id, mId: 'fixture', type: 'NORMAL', currency: 'EUR',
  totalAmount: 70, status: 'DONE', approvedAt: '2026-09-15T09:00:01+09:00', lastTransactionKey: 'tx1' };

test('payment service exposes a server confirmation boundary', () => {
  assert.equal(typeof createPaymentService({}, null, () => new Date()).confirm, 'function');
});

test('runtime requires explicit complete test configuration and never activates a live key', () => {
  const env = { GYCA_PAYMENT_PROVIDER: 'tosspayments-test', TOSS_TEST_MID: 'fixture', TOSS_TEST_SECRET_KEY: 'test_sk_fixture',
    TOSS_EUR_AMOUNT_UNIT: 'major', TOSS_EUR_APPROVAL_REFERENCE: 'local test fixture' };
  assert.equal(configuredTossProvider({}), null);
  assert.equal(configuredTossProvider({ ...env, GYCA_PAYMENT_PROVIDER: 'disabled' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_EUR_APPROVAL_REFERENCE: '' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_TEST_SECRET_KEY: 'live_sk_fixture' }), null);
  assert.equal(configuredTossProvider(env).liveMode, false);
});

test('Toss transport and adapter validate real HTTP responses through a local test server', async (t) => {
  let response = payment;
  let status = 200;
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ url: req.url, method: req.method, headers: req.headers, body: Buffer.concat(chunks).toString() });
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(typeof response === 'string' ? response : JSON.stringify(response));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const destination = server.address();
  assert.equal(typeof destination, 'object');
  const transport = createTossTransport(config.secretKey, (options, callback) => {
    assert.equal(options.hostname, 'api.tosspayments.com'); assert.equal(options.protocol, 'https:');
    assert.ok(options.signal); // Production sets a total request deadline, not only a socket idle timeout.
    return httpRequest({ ...options, hostname: '127.0.0.1', port: destination.port, protocol: 'http:' }, callback);
  });
  const provider = createTossProvider(config, transport);
  t.beforeEach(() => { response = payment; status = 200; requests.length = 0; });
  try {
    await t.test('sends server amount, trailing-colon Basic auth and a stable confirmation key', async () => {
      const evidence = await provider.confirm(order, 'key-one', 'stable-confirmation');
      assert.equal(requests[0].url, '/v1/payments/confirm');
      assert.equal(requests[0].headers.authorization, `Basic ${Buffer.from('test_sk_fixture:').toString('base64')}`);
      assert.equal(requests[0].headers['idempotency-key'], 'stable-confirmation');
      assert.deepEqual(JSON.parse(requests[0].body), { paymentKey: 'key-one', orderId: order.id, amount: 70 });
      assert.equal(evidence.amountMinor, 7000); assert.equal(evidence.paidAt, '2026-09-15T00:00:01.000Z');
    });
    await t.test('cancels only the server amount with a stable idempotency key', async () => {
      response = { ...payment, status: 'PARTIAL_CANCELED', cancels: [{ cancelAmount: 30, transactionKey: 'cancel-tx',
        canceledAt: '2026-09-19T09:00:00+09:00' }] };
      const evidence = await provider.refund(order, 'key-one', 3000, 'Approved refund', 'stable-refund');
      assert.equal(requests[0].url, '/v1/payments/key-one/cancel');
      assert.equal(requests[0].headers['idempotency-key'], 'stable-refund');
      assert.deepEqual(JSON.parse(requests[0].body), { cancelReason: 'Approved refund', cancelAmount: 30 });
      assert.deepEqual(evidence, { refundId: 'cancel-tx', orderId: order.id, paymentId: 'key-one', amountMinor: 3000,
        currency: 'EUR', refundedAt: '2026-09-19T00:00:00.000Z' });
    });
    await t.test('converts fractional major units exactly without rounding fractions of a cent', async () => {
      response = { ...payment, totalAmount: 0.29 };
      assert.equal((await provider.reconcile(order))[0].amountMinor, 29);
      response = { ...payment, totalAmount: 70.001 };
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
    });
    await t.test('requires explicit currency-unit terms rather than assuming merchant EUR support', async () => {
      assert.throws(() => createTossProvider({ ...config, currencyTerms: undefined }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      const minorProvider = createTossProvider({ ...config, currencyTerms: { ...config.currencyTerms, amountUnit: 'minor' } }, transport);
      response = { ...payment, totalAmount: 7000 };
      assert.equal((await minorProvider.confirm(order, 'key-one', 'same')).amountMinor, 7000);
      assert.equal(JSON.parse(requests[0].body).amount, 7000);
    });
    await t.test('rejects live/test key mismatch before making a request', async () => {
      assert.throws(() => createTossProvider({ ...config, liveMode: true }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.equal(requests.length, 0);
    });
    await t.test('ignores forged webhook status and amount and re-reads the order', async () => {
      const body = Buffer.from(JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { ...payment, totalAmount: 1, status: 'ABORTED' } }));
      const evidence = await provider.verifyWebhook(body, new Headers());
      assert.equal(requests[0].url, `/v1/payments/orders/${order.id}`);
      assert.equal(evidence.state, 'succeeded'); assert.equal(evidence.amountMinor, 7000);
      assert.deepEqual(evidence, (await provider.reconcile(order))[0]);
    });
    await t.test('rejects mismatched MID, currency, order and payment reference', async () => {
      for (const wrong of [{ mId: 'other' }, { currency: 'USD' }, { orderId: order.entryId }, { paymentKey: 'other' }]) {
        response = { ...payment, ...wrong };
        await assert.rejects(provider.confirm(order, 'key-one', 'same'), { code: 'FORBIDDEN' });
      }
    });
    await t.test('does not treat authorization in progress as completed payment', async () => {
      response = { ...payment, status: 'IN_PROGRESS', approvedAt: null };
      assert.equal((await provider.reconcile(order))[0].state, 'pending');
    });
    await t.test('marks partial or full cancellation for manual review', async () => {
      for (const state of ['CANCELED', 'PARTIAL_CANCELED']) {
        response = { ...payment, status: state };
        const evidence = (await provider.reconcile(order))[0];
        assert.equal(evidence.state, 'cancelled'); assert.equal(evidence.requiresReview, true);
      }
    });
    await t.test('rejects unknown states, malformed data and success without approval time', async () => {
      for (const wrong of [{ status: 'UNKNOWN' }, { approvedAt: null }, { totalAmount: '70' }]) {
        response = { ...payment, ...wrong };
        await assert.rejects(provider.reconcile(order));
      }
    });
    await t.test('does not follow redirects or retry an ambiguous approval automatically', async () => {
      status = 503; response = { code: 'PROVIDER_ERROR', message: 'not exposed' };
      await assert.rejects(provider.confirm(order, 'key-one', 'same'), { code: 'PAYMENT_UNAVAILABLE' });
      assert.equal(requests.length, 1);
      status = 302;
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
      assert.equal(requests.length, 2);
    });
    await t.test('bounds provider response size and rejects invalid JSON', async () => {
      response = 'not-json'; await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
      response = 'x'.repeat(262145); await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
    });
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
