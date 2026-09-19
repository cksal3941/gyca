import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentOptions } from '../src/server/payments/options.ts';
import { createPaymentOptionsHandler } from '../src/server/payments/options-http.ts';
import { createRoutedOrders } from '../src/server/payments/routed-orders.ts';
import { createPaymentHandlers } from '../src/server/payments/http.ts';
import { createPaymentService } from '../src/server/payments/service.ts';

test('payment route eligibility uses frozen submission and verified configuration', async t => {
  const db = new PGlite(); const at = new Date('2026-09-15T00:00:00Z');
  const provider = { id: 'fixture', merchantAccount: 'private-mid', liveMode: false,
    reconcile: async () => [], verifyWebhook: async () => { throw new Error('not used'); } };
  const create = createRoutedOrders(db, { providers: [provider], now: () => at });
  async function selection(id) {
    const candidate = (await get('alice', id)).routes[0];
    return { routeId: candidate.id, policyToken: candidate.policyToken, acceptedRefundNotice: true };
  }
  const route = { id: 'domestic', enabled: true, provider: provider.id, merchantAccount: provider.merchantAccount,
    liveMode: false, countries: ['KR'], currency: 'EUR', approvalReference: 'fixture approval only',
    label: { en: 'Test card', ko: '테스트 카드' }, refundNotice: { en: 'Test refund terms', ko: '테스트 환불 안내' } };
  const policy = { version: 'test', routes: [route, { ...route, id: 'international', countries: ['DE', 'US'] }] };
  const get = createPaymentOptions(db, { providers: [provider], now: () => at });
  const handler = createPaymentOptionsHandler({ service: get, now: () => at, origin: undefined,
    getUserId: async request => request.headers.get('x-test-user') });
  async function fixture(country = 'KR', cutoff = '2026-09-16T00:00:00Z') {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at)
      VALUES($1,'alice','one','submitted',$2)`, [id, at]);
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'key','hash',$2,$3::jsonb,'{}')`, [id, at, JSON.stringify({ participant: { residenceCountry: country },
        competition: { payment_closes_at: cutoff, public_content: { fee: { amountMinor: 7000, currency: 'EUR' } } } })]);
    return id;
  }
  async function configure(value) { await db.query('UPDATE gyca_competitions SET payment_routing=$1::jsonb', [value === null ? null : JSON.stringify(value)]); }
  t.beforeEach(async () => { await db.exec('TRUNCATE gyca_entries CASCADE'); await configure(policy); });
  try {
    await db.exec(`CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES('alice')`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','006_payment_confirmations','007_payment_recovery','008_payment_admin','009_payment_routing','010_order_routes'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO gyca_competitions(id,slug,payment_enabled) VALUES('one','one',true)`);
    await db.exec(`UPDATE gyca_competitions SET payment_policy='{"version":"test","approvalBasis":"provider_paid_at"}'`);
    await t.test('selected route creates one order and immutable accepted terms', async () => {
      const id = await fixture(); const input = await selection(id); const target = { entryId: id, key: randomUUID() };
      const order = await create('alice', target, input);
      assert.equal(order.money.amountMinor, 7000);
      assert.equal((await create('alice', target, input)).id, order.id);
      assert.equal((await create('alice', { ...target, key: randomUUID() }, input)).id, order.id);
      const saved = (await db.query('SELECT actor_id,terms FROM gyca_order_routes')).rows[0];
      assert.equal(saved.actor_id, 'alice'); assert.equal(saved.terms.route.refundNotice.en, route.refundNotice.en);
      await assert.rejects(db.query("UPDATE gyca_order_routes SET route_id='other'"), /immutable/);
      await assert.rejects(db.query('DELETE FROM gyca_order_routes'), /immutable/);
      await assert.rejects(create('alice', target, { ...input, routeId: 'international' }), { code: 'IDEMPOTENCY_CONFLICT' });
      await configure(null);
      assert.equal((await create('alice', target, input)).id, order.id);
    });
    await t.test('changed terms, wrong country, disabled provider and foreign owner are refused before creating orders', async () => {
      const id = await fixture(); const input = await selection(id); const target = { entryId: id, key: randomUUID() };
      await assert.rejects(create('bob', target, input), { code: 'NOT_FOUND' });
      await assert.rejects(create('alice', target, { ...input, routeId: 'international' }), { code: 'PAYMENT_UNAVAILABLE' });
      await assert.rejects(createRoutedOrders(db, { providers: [], now: () => at })('alice', target, input), { code: 'PAYMENT_UNAVAILABLE' });
      await configure({ ...policy, version: 'changed' });
      await assert.rejects(create('alice', target, input), { code: 'CONSENT_REQUIRED' });
      assert.equal((await db.query('SELECT * FROM gyca_orders')).rows.length, 0);
    });
    await t.test('route evidence failure rolls back the order and its idempotency key', async () => {
      const id = await fixture(); const input = await selection(id);
      const failing = { transaction: run => db.transaction(tx => run({ query: (sql, values) => {
        if (sql.includes('INSERT INTO gyca_order_routes')) throw new Error('route evidence failure');
        return tx.query(sql, values);
      } })) };
      await assert.rejects(createRoutedOrders(failing, { providers: [provider], now: () => at })('alice', { entryId: id, key: randomUUID() }, input), /route evidence/);
      assert.equal((await db.query('SELECT * FROM gyca_orders')).rows.length, 0);
      assert.equal((await db.query('SELECT * FROM gyca_order_creation_keys')).rows.length, 0);
    });
    await t.test('runtime-style HTTP requires route and explicit refund acceptance', async () => {
      const id = await fixture(); const input = await selection(id);
      const api = createPaymentHandlers({ service: createPaymentService(db, provider, () => at), createRoutedOrder: create,
        now: () => at, origin: 'https://gyca.test', getUserId: async () => 'alice' });
      const request = body => new Request('https://gyca.test/api', { method: 'POST', headers: {
        origin: 'https://gyca.test', 'content-type': 'application/json', 'idempotency-key': randomUUID(),
      }, body: JSON.stringify(body) });
      assert.equal((await api.create(request({}), id)).status, 422);
      assert.equal((await api.create(request({ ...input, acceptedRefundNotice: false }), id)).status, 422);
      assert.equal((await api.create(request({ ...input, amountMinor: 1 }), id)).status, 422);
      assert.equal((await api.create(request(input), id)).status, 201);
    });
    await t.test('returns separate domestic and international candidate routes without currency conversion', async () => {
      const domestic = await get('alice', await fixture());
      const international = await get('alice', await fixture('DE'));
      assert.deepEqual(domestic.routes.map(r => r.id), ['domestic']);
      assert.deepEqual(international.routes.map(r => r.id), ['international']);
      assert.deepEqual(international.money, { amountMinor: 7000, currency: 'EUR' });
      assert.equal(international.routes[0].mode, 'test');
      assert.deepEqual(international.allowedActions, ['create_order']);
      assert.doesNotMatch(JSON.stringify(international), /private-mid|fixture approval/);
    });
    await t.test('unsupported countries and unavailable providers do not receive routes', async () => {
      assert.deepEqual((await get('alice', await fixture('JP'))).routes, []);
      const id = await fixture();
      for (const providers of [[], [{ ...provider, merchantAccount: 'different' }], [{ ...provider, liveMode: true }]])
        assert.deepEqual((await createPaymentOptions(db, { providers, now: () => at })('alice', id)).routes, []);
    });
    await t.test('missing, duplicate, disabled or unapproved policies fail closed', async () => {
      const id = await fixture();
      for (const value of [null, { ...policy, routes: [route, route] }, { ...policy, routes: [{ ...route, approvalReference: '' }] }]) {
        await configure(value);
        assert.deepEqual((await get('alice', id)).blockingReasons, ['POLICY_NOT_CONFIGURED']);
      }
      await configure({ ...policy, routes: [{ ...route, enabled: false }] });
      assert.deepEqual((await get('alice', id)).routes, []);
    });
    await t.test('exact payment cutoff blocks routes', async () => {
      assert.deepEqual((await get('alice', await fixture('KR', at.toISOString()))).blockingReasons, ['DEADLINE_PASSED']);
    });
    await t.test('any existing order prevents switching even after a failed payment', async () => {
      const id = await fixture();
      await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,
        approval_basis,provider,merchant_account,live_mode,state,created_at)
        VALUES($1,$1,7000,'EUR',$2,'test','provider_paid_at','fixture','private-mid',false,'failed',$2)`, [id, at]);
      const result = await get('alice', id);
      assert.deepEqual(result.routes, []); assert.deepEqual(result.blockingReasons, ['ENTRY_LOCKED']);
    });
    await t.test('authentication, ownership and frozen country cannot be bypassed via query parameters', async () => {
      const id = await fixture('DE');
      assert.equal((await handler(new Request('http://localhost:3000/api'), id)).status, 401);
      await assert.rejects(get('bob', id), { code: 'NOT_FOUND' });
      const response = await handler(new Request('http://localhost:3000/api?country=KR&amountMinor=1', { headers: { 'x-test-user': 'alice' } }), id);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const body = await response.json(); assert.equal(body.data.country, 'DE'); assert.equal(body.data.money.amountMinor, 7000);
    });
  } finally { await db.close(); }
});
