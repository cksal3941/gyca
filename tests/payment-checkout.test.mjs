import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentHandlers } from '../src/server/payments/http.ts';
import { createPaymentService } from '../src/server/payments/service.ts';

test('hosted checkout sessions are owner-scoped, server-gated and browser-safe', async (t) => {
  const db = new PGlite();
  const base = Date.parse('2026-09-18T00:00:00Z');
  let current = base;
  const now = () => new Date(current);
  const checkoutCalls = [];
  let invalidResponse = false;
  const provider = {
    id: 'hosted-fixture', merchantAccount: 'fixture-merchant', liveMode: false,
    async beginCheckout(order, customerReference) {
      checkoutCalls.push({ order, customerReference });
      return {
        orderId: invalidResponse ? randomUUID() : order.id,
        provider: 'hosted-fixture', mode: 'test',
        expiresAt: new Date(base + 30000).toISOString(),
        launch: { kind: 'redirect', url: `https://checkout.example.test/session/${order.id}` },
      };
    },
    async verifyWebhook() { return {}; },
    async reconcile() { return []; },
  };
  const service = createPaymentService(db, provider, now);
  const handlers = createPaymentHandlers({ service, now, origin: 'https://gyca.test',
    getUserId: async (request) => request.headers.get('x-test-user') });
  const request = (body = {}, headers = {}) => new Request('https://gyca.test/checkout', { method: 'POST',
    headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-test-user': 'alice', ...headers },
    body: JSON.stringify(body),
  });
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'),(\'bob\');');
    for (const name of ['001_entries', '002_competitions', '003_uploads', '004_submissions', '005_payments'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.query(`INSERT INTO gyca_competitions(id,slug,payment_enabled,payment_policy)
      VALUES('test','test',true,$1::jsonb)`, [JSON.stringify({ version: 'checkout-v1', approvalBasis: 'provider_paid_at' })]);
    const entryId = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at)
      VALUES($1,'alice','test','submitted',$2)`, [entryId, new Date(base - 1000)]);
    const snapshot = { competition: { payment_closes_at: new Date(base + 60000).toISOString(),
      public_content: { fee: { amountMinor: 7000, currency: 'EUR' } } } };
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'submit','hash',$2,$3::jsonb,'{}')`, [entryId, new Date(base - 1000), JSON.stringify(snapshot)]);
    const order = await service.create('alice', entryId, 'checkout-order');

    await t.test('advertises and creates a checkout only while the immutable order is payable', async () => {
      assert.deepEqual(order.allowedActions, ['start_payment', 'check_payment']);
      const response = await handlers.checkout(request(), order.id);
      assert.equal(response.status, 200);
      const session = (await response.json()).data;
      assert.equal(session.orderId, order.id);
      assert.equal(session.launch.kind, 'redirect');
      assert.match(session.launch.url, /^https:\/\//);
      assert.match(checkoutCalls[0].customerReference, /^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(session).includes('alice'));
    });

    await t.test('rejects unowned, cross-origin and expanded browser input', async () => {
      assert.equal((await handlers.checkout(request({}, { 'x-test-user': 'bob' }), order.id)).status, 404);
      assert.equal((await handlers.checkout(request({}, { origin: 'https://evil.test' }), order.id)).status, 403);
      assert.equal((await handlers.checkout(request({ amountMinor: 1 }), order.id)).status, 422);
    });

    await t.test('rejects provider identity substitution and an expired order', async () => {
      invalidResponse = true;
      assert.equal((await handlers.checkout(request(), order.id)).status, 502);
      invalidResponse = false;
      current = base + 60000;
      assert.equal((await handlers.checkout(request(), order.id)).status, 409);
      assert.deepEqual((await service.get('alice', order.id)).allowedActions, ['check_payment']);
    });

    await t.test('keeps checkout unavailable when no configured provider can launch it', async () => {
      const disabled = createPaymentService(db, null, now);
      assert.deepEqual((await disabled.get('alice', order.id)).allowedActions, []);
      await assert.rejects(disabled.checkout('alice', order.id), { code: 'PAYMENT_UNAVAILABLE' });
    });
  } finally {
    await db.close();
  }
});
