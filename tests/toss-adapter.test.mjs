import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaymentService } from '../src/server/payments/service.ts';
import { createTossProvider, createTossTransport, configuredTossProvider, configuredTossProviders } from '../src/server/payments/toss.ts';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';

const order = { id: '00000000-0000-4000-8000-000000000001', entryId: '00000000-0000-4000-8000-000000000002',
  kind: 'entry_fee', money: { amountMinor: 100000, currency: 'KRW' }, state: 'pending', needsReview: false,
  createdAt: '2026-09-15T00:00:00Z', paymentClosesAtExclusive: '2027-01-01T00:00:00Z',
  approvalBasis: 'provider_paid_at', policyVersion: 'test', allowedActions: [], blockingReasons: [] };
const usdOrder = { ...order, id: '00000000-0000-4000-8000-000000000003', money: { amountMinor: 7000, currency: 'USD' } };
const config = { secretKey: 'test_sk_fixture', clientKey: 'test_ck_fixture', merchantAccount: 'fixture', liveMode: false,
  currency: 'KRW', siteOrigin: 'https://gyca.test' };
const payment = { paymentKey: 'key-one', orderId: order.id, mId: 'fixture', type: 'NORMAL', currency: 'KRW',
  totalAmount: 100000, status: 'DONE', approvedAt: '2026-09-15T09:00:01+09:00', lastTransactionKey: 'tx1' };

test('payment service exposes a server confirmation boundary', () => {
  assert.equal(typeof createPaymentService({}, null, () => new Date()).confirm, 'function');
});

test('runtime activation requires an explicit mode and keys that match it', () => {
  const env = { GYCA_PAYMENT_PROVIDER: 'tosspayments', TOSS_MODE: 'test', TOSS_MID: 'fixture', TOSS_SECRET_KEY: 'test_sk_fixture',
    TOSS_CLIENT_KEY: 'test_ck_fixture', BETTER_AUTH_URL: 'https://gyca.test' };
  assert.equal(configuredTossProvider({}), null);
  assert.equal(configuredTossProvider({ ...env, GYCA_PAYMENT_PROVIDER: 'disabled' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_MODE: '' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_SECRET_KEY: 'live_sk_fixture' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_CLIENT_KEY: 'live_ck_fixture' }), null);
  assert.equal(configuredTossProvider({ ...env, TOSS_CURRENCY: 'EUR' }), null, 'Toss does not bill EUR');
  const testProvider = configuredTossProvider(env);
  assert.equal(testProvider.liveMode, false); assert.equal(testProvider.id, 'tosspayments');
  assert.equal(typeof testProvider.beginCheckout, 'function');
  // Verification-only configuration (no client key or no public origin) never advertises a window.
  assert.equal(configuredTossProvider({ ...env, TOSS_CLIENT_KEY: '' }).beginCheckout, undefined);
  assert.equal(configuredTossProvider({ ...env, BETTER_AUTH_URL: 'http://localhost:3000' }).beginCheckout, undefined);
  // Legacy test-only activation keeps working with the old variable names.
  const legacy = configuredTossProvider({ GYCA_PAYMENT_PROVIDER: 'tosspayments-test', TOSS_TEST_MID: 'fixture', TOSS_TEST_SECRET_KEY: 'test_sk_fixture' });
  assert.equal(legacy.liveMode, false); assert.equal(legacy.beginCheckout, undefined);
  assert.equal(configuredTossProvider({ GYCA_PAYMENT_PROVIDER: 'tosspayments-test', TOSS_TEST_MID: 'fixture', TOSS_TEST_SECRET_KEY: 'live_sk_fixture' }), null);
  // Live mode needs TOSS_MODE=live, live keys and a written contract reference; a live key alone is inert.
  const live = { ...env, TOSS_MODE: 'live', TOSS_SECRET_KEY: 'live_sk_fixture', TOSS_CLIENT_KEY: 'live_ck_fixture' };
  assert.equal(configuredTossProvider(live), null);
  assert.equal(configuredTossProvider({ ...live, TOSS_MODE: 'test' }), null);
  assert.equal(configuredTossProvider({ ...live, TOSS_APPROVAL_REFERENCE: 'Toss merchant contract 2026-10' }).liveMode, true);
});

test('a PayPal merchant account is a second provider on its own MID billing USD', () => {
  const env = { GYCA_PAYMENT_PROVIDER: 'tosspayments', TOSS_MODE: 'test', TOSS_MID: 'card-mid', TOSS_SECRET_KEY: 'test_sk_card',
    TOSS_CLIENT_KEY: 'test_ck_card', BETTER_AUTH_URL: 'https://gyca.test',
    TOSS_PAYPAL_MID: 'paypal-mid', TOSS_PAYPAL_SECRET_KEY: 'test_sk_paypal', TOSS_PAYPAL_CLIENT_KEY: 'test_ck_paypal' };
  const providers = configuredTossProviders(env);
  assert.deepEqual(providers.map(p => [p.id, p.merchantAccount, p.liveMode]), [['tosspayments', 'card-mid', false], ['tosspayments', 'paypal-mid', false]]);
  // A half-configured PayPal MID disables payments instead of silently running card-only.
  assert.deepEqual(configuredTossProviders({ ...env, TOSS_PAYPAL_SECRET_KEY: '' }), []);
  assert.deepEqual(configuredTossProviders({ ...env, TOSS_PAYPAL_SECRET_KEY: 'live_sk_paypal' }), []);
  // One MID bills one currency: the same MID cannot serve both methods.
  assert.deepEqual(configuredTossProviders({ ...env, TOSS_PAYPAL_MID: 'card-mid' }), []);
  // PayPal without a card MID is also allowed.
  const paypalOnly = configuredTossProviders({ ...env, TOSS_MID: '', TOSS_SECRET_KEY: '', TOSS_CLIENT_KEY: '' });
  assert.deepEqual(paypalOnly.map(p => p.merchantAccount), ['paypal-mid']);
  assert.throws(() => createTossProvider({ secretKey: 'test_sk_x', merchantAccount: 'm', liveMode: false, currency: 'KRW', method: 'FOREIGN_EASY_PAY' }), { code: 'POLICY_NOT_CONFIGURED' });
});

test('PayPal checkout carries the buyer country and the purchased item, never a shipping block', async () => {
  const now = () => new Date('2026-09-20T00:00:00Z');
  const paypal = createTossProvider({ secretKey: 'test_sk_paypal', clientKey: 'test_ck_paypal', merchantAccount: 'paypal-mid', liveMode: false,
    currency: 'USD', method: 'FOREIGN_EASY_PAY', siteOrigin: 'https://gyca.test' }, async () => ({ status: 500, body: {} }), now);
  const session = await paypal.beginCheckout(usdOrder, 'b'.repeat(64), { buyerCountry: 'DE' });
  assert.equal(session.launch.method, 'FOREIGN_EASY_PAY');
  assert.deepEqual(session.launch.amount, { currency: 'USD', value: 70 });
  assert.deepEqual(session.launch.foreignEasyPay, { provider: 'PAYPAL', country: 'DE', products: [{ name: 'GYCA Entry Fee', quantity: 1,
    unitAmount: 70, currency: 'USD', description: 'Global Youth Creative Awards competition entry fee (digital service, no shipping)' }] });
  assert.equal('shipping' in session.launch.foreignEasyPay, false);
  // The buyer country comes from the frozen submission; without it no PayPal window is described.
  await assert.rejects(paypal.beginCheckout(usdOrder, 'b'.repeat(64), {}), { code: 'PAYMENT_UNAVAILABLE' });
  await assert.rejects(paypal.beginCheckout(usdOrder, 'b'.repeat(64), { buyerCountry: 'germany' }), { code: 'PAYMENT_UNAVAILABLE' });
  // A KRW order never reaches the PayPal MID.
  await assert.rejects(paypal.beginCheckout(order, 'b'.repeat(64), { buyerCountry: 'KR' }), { code: 'POLICY_NOT_CONFIGURED' });
  // Card windows carry no PayPal block.
  const card = createTossProvider(config, async () => ({ status: 500, body: {} }), now);
  assert.equal((await card.beginCheckout(order, 'a'.repeat(64), { buyerCountry: 'KR' })).launch.foreignEasyPay, undefined);
});

test('Toss browser-SDK checkout carries only server-fixed launch values', async () => {
  const now = () => new Date('2026-09-20T00:00:00Z');
  const provider = createTossProvider(config, async () => ({ status: 500, body: {} }), now);
  const reference = 'a'.repeat(64);
  const session = await provider.beginCheckout(order, reference);
  assert.equal(session.orderId, order.id); assert.equal(session.provider, 'tosspayments'); assert.equal(session.mode, 'test');
  assert.equal(session.expiresAt, '2026-09-20T00:30:00.000Z');
  assert.deepEqual(session.launch, { kind: 'tosspayments_sdk', clientKey: 'test_ck_fixture', customerKey: `gyca-${'a'.repeat(40)}`,
    orderName: 'GYCA Entry Fee', method: 'CARD', amount: { currency: 'KRW', value: 100000 },
    successUrl: `https://gyca.test/mypage/entries/${order.entryId}/payment/success`,
    failUrl: `https://gyca.test/mypage/entries/${order.entryId}/payment/fail` });
  // Expiry never passes the order's own payment deadline.
  const closing = await provider.beginCheckout({ ...order, paymentClosesAtExclusive: '2026-09-20T00:05:00Z' }, reference);
  assert.equal(closing.expiresAt, '2026-09-20T00:05:00.000Z');
  await assert.rejects(provider.beginCheckout({ ...order, paymentClosesAtExclusive: '2026-09-20T00:00:00Z' }, reference), { code: 'DEADLINE_PASSED' });
  // An order in a currency this merchant cannot bill is refused rather than converted.
  await assert.rejects(provider.beginCheckout({ ...order, money: { amountMinor: 7000, currency: 'EUR' } }, reference), { code: 'POLICY_NOT_CONFIGURED' });
  await assert.rejects(provider.confirm({ ...order, money: { amountMinor: 7000, currency: 'EUR' } }, 'key', 'k'), { code: 'POLICY_NOT_CONFIGURED' });
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
  const usdProvider = createTossProvider({ ...config, currency: 'USD', method: 'FOREIGN_EASY_PAY' }, transport);
  const usdPayment = { ...payment, orderId: usdOrder.id, currency: 'USD', totalAmount: 70 };
  t.beforeEach(() => { response = payment; status = 200; requests.length = 0; });
  try {
    await t.test('sends the server amount in whole won, trailing-colon Basic auth and a stable confirmation key', async () => {
      const evidence = await provider.confirm(order, 'key-one', 'stable-confirmation');
      assert.equal(requests[0].url, '/v1/payments/confirm');
      assert.equal(requests[0].headers.authorization, `Basic ${Buffer.from('test_sk_fixture:').toString('base64')}`);
      assert.equal(requests[0].headers['idempotency-key'], 'stable-confirmation');
      assert.deepEqual(JSON.parse(requests[0].body), { paymentKey: 'key-one', orderId: order.id, amount: 100000 });
      assert.equal(evidence.amountMinor, 100000); assert.equal(evidence.currency, 'KRW');
      assert.equal(evidence.paidAt, '2026-09-15T00:00:01.000Z');
    });
    await t.test('cancels only the server amount with a stable idempotency key', async () => {
      response = { ...payment, status: 'PARTIAL_CANCELED', cancels: [{ cancelAmount: 30000, transactionKey: 'cancel-tx',
        canceledAt: '2026-09-19T09:00:00+09:00' }] };
      const evidence = await provider.refund(order, 'key-one', 30000, 'Approved refund', 'stable-refund');
      assert.equal(requests[0].url, '/v1/payments/key-one/cancel');
      assert.equal(requests[0].headers['idempotency-key'], 'stable-refund');
      assert.deepEqual(JSON.parse(requests[0].body), { cancelReason: 'Approved refund', cancelAmount: 30000 });
      assert.deepEqual(evidence, { refundId: 'cancel-tx', orderId: order.id, paymentId: 'key-one', amountMinor: 30000,
        currency: 'KRW', refundedAt: '2026-09-19T00:00:00.000Z' });
    });
    await t.test('rejects fractional won', async () => {
      response = { ...payment, totalAmount: 100000.5 };
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
    });
    await t.test('converts USD major units exactly without rounding fractions of a cent', async () => {
      response = usdPayment;
      const evidence = await usdProvider.confirm(usdOrder, 'key-one', 'usd');
      assert.equal(JSON.parse(requests[0].body).amount, 70); assert.equal(evidence.amountMinor, 7000);
      response = { ...usdPayment, totalAmount: 0.29 };
      assert.equal((await usdProvider.reconcile(usdOrder))[0].amountMinor, 29);
      response = { ...usdPayment, totalAmount: 70.001 };
      await assert.rejects(usdProvider.reconcile(usdOrder), { code: 'PAYMENT_UNAVAILABLE' });
    });
    await t.test('PayPal cancellations name the currency and only a completed cancel becomes refund evidence', async () => {
      const paypal = usdProvider;
      response = { ...usdPayment, status: 'PARTIAL_CANCELED', cancels: [{ cancelAmount: 30, transactionKey: 'pp-cancel', cancelStatus: 'DONE',
        canceledAt: '2026-09-19T09:00:00+09:00' }] };
      const evidence = await paypal.refund(usdOrder, 'key-one', 3000, 'Approved refund', 'pp-refund');
      assert.deepEqual(JSON.parse(requests[0].body), { cancelReason: 'Approved refund', cancelAmount: 30, currency: 'USD' });
      assert.equal(evidence.amountMinor, 3000); assert.equal(evidence.currency, 'USD');
      response = { ...usdPayment, status: 'PARTIAL_CANCELED', cancels: [{ cancelAmount: 30, transactionKey: 'pp-cancel', cancelStatus: 'IN_PROGRESS',
        canceledAt: '2026-09-19T09:00:00+09:00' }] };
      await assert.rejects(paypal.refund(usdOrder, 'key-one', 3000, 'Approved refund', 'pp-refund'), { code: 'PAYMENT_UNAVAILABLE' });
      // Card cancellations keep the documented body.
      response = { ...payment, status: 'PARTIAL_CANCELED', cancels: [{ cancelAmount: 30000, transactionKey: 'c', canceledAt: '2026-09-19T09:00:00+09:00' }] };
      await provider.refund(order, 'key-one', 30000, 'Approved refund', 'card-refund');
      assert.deepEqual(JSON.parse(requests.at(-1).body), { cancelReason: 'Approved refund', cancelAmount: 30000 });
    });
    await t.test('webhooks naming another merchant account are refused before any lookup', async () => {
      const body = Buffer.from(JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { ...payment, mId: 'someone-else' } }));
      await assert.rejects(provider.verifyWebhook(body, new Headers()), { code: 'FORBIDDEN' });
      assert.equal(requests.length, 0);
    });
    await t.test('rejects incomplete configuration and live/test key mismatch before making a request', async () => {
      assert.throws(() => createTossProvider({ ...config, currency: undefined }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.throws(() => createTossProvider({ ...config, currency: 'EUR' }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.throws(() => createTossProvider({ ...config, liveMode: true }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.throws(() => createTossProvider({ ...config, clientKey: 'live_ck_fixture' }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.throws(() => createTossProvider({ ...config, siteOrigin: 'http://gyca.test' }, transport), { code: 'POLICY_NOT_CONFIGURED' });
      assert.equal(requests.length, 0);
    });
    await t.test('ignores forged webhook status and amount and re-reads the order', async () => {
      const body = Buffer.from(JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', createdAt: '2026-09-15T09:00:02+09:00',
        data: { ...payment, totalAmount: 1, status: 'ABORTED' } }));
      const evidence = await provider.verifyWebhook(body, new Headers());
      assert.equal(requests[0].url, `/v1/payments/orders/${order.id}`);
      assert.equal(evidence.state, 'succeeded'); assert.equal(evidence.amountMinor, 100000);
      assert.deepEqual(evidence, (await provider.reconcile(order))[0]);
      await assert.rejects(provider.verifyWebhook(Buffer.from(JSON.stringify({ eventType: 'BILLING_DELETED', data: { billingKey: 'x' } })), new Headers()),
        { code: 'VALIDATION_FAILED' });
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
      status = 302; response = '';
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
    });
    await t.test('fails closed on oversized or non-JSON bodies', async () => {
      response = 'x'.repeat(300000);
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
      response = 'not json';
      await assert.rejects(provider.reconcile(order), { code: 'PAYMENT_UNAVAILABLE' });
    });
  } finally {
    server.close();
  }
});
