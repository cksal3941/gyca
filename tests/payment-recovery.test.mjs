import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createPaymentRecovery } from '../src/server/payments/recovery.ts';
import { createRecoveryHandler } from '../src/server/payments/recovery-http.ts';
import { createPaymentService } from '../src/server/payments/service.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { EntryFault } from '../src/server/entries/errors.ts';

test('durable recovery uses provider lookup and survives interrupted workers', async (t) => {
  const db = new PGlite(); const base = Date.parse('2026-09-15T00:00:00Z');
  let current = base; const now = () => new Date(current);
  let lookups = 0; let lookup = async () => [];
  const provider = { id: 'fixture', merchantAccount: 'recovery-test', liveMode: false,
    async reconcile(order) { lookups++; return lookup(order); },
    async verifyWebhook(bytes) { return JSON.parse(Buffer.from(bytes).toString()); },
    async confirm() { assert.fail('Recovery must never request an approval'); },
  };
  const service = createPaymentService(db, provider, now);
  const worker = () => createPaymentRecovery(db, provider, service, now);
  const evidence = (order, state = 'succeeded') => ({ eventId: `${order.id}:${state}`, paymentId: order.id,
    orderId: order.id, merchantAccount: provider.merchantAccount, liveMode: false, state,
    amountMinor: 7000, currency: 'EUR', paidAt: state === 'succeeded' ? new Date(base + 1000).toISOString() : null });
  async function fixture(scope = provider, started = true) {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at) VALUES($1,'alice','test','submitted',$2)`, [id, new Date(base - 1000)]);
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'key','hash',$2,$3::jsonb,'{}')`, [id, new Date(base - 1000), JSON.stringify({ competition: {
        payment_closes_at: new Date(base + 60000).toISOString(), public_content: { fee: { amountMinor: 7000, currency: 'EUR' } } } })]);
    const order = await createPaymentService(db, scope, now).create('alice', id, randomUUID());
    if (started) await db.query(`INSERT INTO gyca_payment_confirmations(order_id,payment_key,idempotency_key,requested_at,replay_until)
      VALUES($1,$2,$3,$4,$5)`, [order.id, order.id, randomUUID(), now(), new Date(base + 15 * 86400000)]);
    return order;
  }
  t.beforeEach(async () => {
    await db.exec('TRUNCATE gyca_entries CASCADE');
    current = base; lookups = 0; lookup = async () => [];
  });
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\');');
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','006_payment_confirmations','007_payment_recovery'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.query(`INSERT INTO gyca_competitions(id,slug,payment_enabled,payment_policy) VALUES('test','test',true,$1::jsonb)`,
      [JSON.stringify({ version: 'test', approvalBasis: 'provider_paid_at' })]);
    await t.test('discovers an order without a browser retry and recovers late notification', async () => {
      const order = await fixture(); current = base + 120000;
      lookup = async (o) => [evidence(o)];
      assert.deepEqual(await worker().runOnce(), { outcome: 'completed' });
      const entry = await createEntryRepository(db, now).get('alice', order.entryId);
      assert.equal(entry.entryStatus, 'received'); assert.ok(entry.receiptNumber);
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      assert.equal(lookups, 1);
    });
    await t.test('persists backoff across worker instances', async () => {
      await fixture(); lookup = async () => { throw new EntryFault('PAYMENT_UNAVAILABLE', 503); };
      assert.deepEqual(await worker().runOnce(), { outcome: 'retry_scheduled' });
      const row = (await db.query('SELECT * FROM gyca_payment_recovery')).rows[0];
      assert.equal(row.last_error_code, 'PAYMENT_UNAVAILABLE'); assert.equal(row.attempts, 1);
      assert.equal(new Date(row.due_at).getTime(), base + 30000);
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      current += 30000;
      await worker().runOnce();
      assert.equal(lookups, 2);
      assert.equal(new Date((await db.query('SELECT due_at FROM gyca_payment_recovery')).rows[0].due_at).getTime(), current + 60000);
    });
    await t.test('does not count a participants recent lookup as a recovery failure', async () => {
      const order = await fixture(); await service.reconcile('alice', order.id);
      assert.deepEqual(await worker().runOnce(), { outcome: 'retry_scheduled' });
      const row = (await db.query('SELECT * FROM gyca_payment_recovery')).rows[0];
      assert.equal(row.attempts, 0); assert.equal(row.last_error_code, 'RATE_LIMITED');
      assert.equal(lookups, 1);
    });
    await t.test('separates provider, merchant and test/live scopes', async () => {
      await fixture({ ...provider, merchantAccount: 'other' });
      await fixture({ ...provider, liveMode: true });
      await fixture({ ...provider, id: 'other' });
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      assert.equal(lookups, 0);
    });
    await t.test('reclaims an expired lease and fences the stale worker completion', async () => {
      const order = await fixture(); current += 2000;
      const started = Promise.withResolvers(); const resume = Promise.withResolvers();
      lookup = async (o) => {
        if (lookups === 1) { started.resolve(); await resume.promise; return [evidence(o, 'pending')]; }
        return [evidence(o)];
      };
      const old = worker().runOnce(); await started.promise;
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      current += 120001;
      assert.deepEqual(await worker().runOnce(), { outcome: 'completed' });
      resume.resolve(); assert.deepEqual(await old, { outcome: 'superseded' });
      assert.equal((await db.query('SELECT state FROM gyca_payment_recovery')).rows[0].state, 'completed');
      assert.equal((await createEntryRepository(db, now).get('alice', order.entryId)).entryStatus, 'received');
    });
    await t.test('handles distinct jobs during overlapping worker execution', async () => {
      await fixture(); await fixture(); current += 2000;
      const started = Promise.withResolvers(); const resume = Promise.withResolvers();
      lookup = async (o) => { if (lookups === 1) { started.resolve(); await resume.promise; } return [evidence(o)]; };
      const first = worker().runOnce(); await started.promise;
      assert.deepEqual(await worker().runOnce(), { outcome: 'completed' });
      resume.resolve(); assert.deepEqual(await first, { outcome: 'completed' });
      assert.equal((await db.query("SELECT * FROM gyca_payment_recovery WHERE state='completed'")).rows.length, 2);
    });
    await t.test('escalates after bounded retries without expiring the entry or blocking later payment evidence', async () => {
      const order = await fixture();
      for (let i = 0; i < 12; i++) { await worker().runOnce(); current += 900001; }
      assert.equal((await db.query('SELECT state FROM gyca_payment_recovery')).rows[0].state, 'stalled');
      assert.equal((await db.query("SELECT * FROM gyca_payment_outbox WHERE kind='payment_review'")).rows.length, 1);
      assert.equal((await service.get('alice', order.id)).needsReview, false);
      assert.equal((await createEntryRepository(db, now).get('alice', order.entryId)).entryStatus, 'submitted');
      await service.webhook(Buffer.from(JSON.stringify(evidence(order))), new Headers());
      assert.equal((await createEntryRepository(db, now).get('alice', order.entryId)).entryStatus, 'received');
    });
    await t.test('escalates a worker that crashed on its final attempt', async () => {
      const order = await fixture();
      await db.query(`INSERT INTO gyca_payment_recovery(order_id,state,attempts,due_at,lease_token,lease_until,updated_at)
        VALUES($1,'running',12,$2,$3,$2,$2)`, [order.id, now(), randomUUID()]);
      assert.deepEqual(await worker().runOnce(), { outcome: 'stalled' });
      assert.equal(lookups, 0);
    });
    await t.test('keeps the internal endpoint disabled or authenticated before work starts', async () => {
      let runs = 0;
      const fake = { async runOnce() { runs++; return { outcome: 'idle' }; } };
      const token = 'a'.repeat(40);
      const handler = createRecoveryHandler({ enabled: true, token, worker: fake });
      const request = (authorization, body = '{}') => new Request('https://gyca.test/internal', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization }, body });
      assert.equal((await handler(request(''))).status, 401);
      assert.equal((await handler(request(`Bearer ${token}`, '{"orderId":"forged"}'))).status, 422);
      const response = await handler(request(`Bearer ${token}`));
      assert.equal(response.status, 200); assert.equal(runs, 1);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal((await createRecoveryHandler({ enabled: false, token, worker: fake })(request(`Bearer ${token}`))).status, 503);
    });
    await t.test('does not discover or claim jobs without a configured provider', async () => {
      await fixture();
      await assert.rejects(createPaymentRecovery(db, null, service, now).runOnce(), { code: 'PAYMENT_UNAVAILABLE' });
      assert.equal((await db.query('SELECT * FROM gyca_payment_recovery')).rows.length, 0);
    });
    await t.test('does not poll an order that has never started a payment', async () => {
      await fixture(provider, false);
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      assert.equal(lookups, 0);
    });
  } finally { await db.close(); }
});
