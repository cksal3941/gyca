import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createReceiptWorker } from '../src/server/notifications/receipt-worker.ts';
import { createResendMailer, configuredReceiptMailer } from '../src/server/notifications/resend.ts';
import { createRecoveryHandler } from '../src/server/payments/recovery-http.ts';

test('receipt email delivery is separate from receipt confirmation', async t => {
  const db = new PGlite(); const base = Date.parse('2026-09-16T00:00:00Z'); let current = base;
  const sent = []; let fail = false;
  const mailer = { from: 'receipts@example.org', send: async (payload, key) => { sent.push({ payload, key }); if (fail) throw new Error('provider failure'); return 'message-1'; } };
  const worker = () => createReceiptWorker(db, mailer, () => new Date(current));
  async function fixture(kind = 'entry_received', state = 'received') {
    const id = randomUUID(); const at = new Date(base);
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number)
      VALUES($1,'alice','test',$2,$3,$4,$5)`, [id, state, at, state === 'received' ? at : null, state === 'received' ? `GYCA-${id}` : null]);
    await db.query(`INSERT INTO gyca_submissions VALUES($1,'key','hash',$2,'{}','{}')`, [id, at]);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,
      provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
      VALUES($1::uuid,$1::uuid,7000,'EUR',$2,'test','provider_paid_at','fixture','fixture',false,'succeeded',$1::text,$2,$2)`, [id, at]);
    await db.query(`INSERT INTO gyca_payment_outbox(key,kind,entry_id,order_id,created_at,email_due_at) VALUES($1::text,$2,$1::uuid,$1::uuid,$3,$3)`, [id, kind, at]);
    return id;
  }
  t.beforeEach(async () => { await db.exec('TRUNCATE gyca_entries CASCADE'); current = base; sent.length = 0; fail = false;
    await db.exec(`UPDATE "user" SET email='alice@example.org',"emailVerified"=true`); });
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean); INSERT INTO "user" VALUES('alice','alice@example.org',true)`);
    for (const name of ['001_entries','002_competitions','003_uploads','004_submissions','005_payments','006_payment_confirmations','007_payment_recovery','008_payment_admin','009_payment_routing','010_order_routes','011_competition_admin','012_receipt_email'])
      await db.exec(await readFile(new URL(`../migrations/${name}.sql`, import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('test','test')`);
    await t.test('organizer sees scoped delivery status without recipient or message payload', async () => {
      const { createReceiptAdminHandler } = await import('../src/server/notifications/receipt-admin.ts');
      const handler = createReceiptAdminHandler({ database: db, now: () => new Date(current), origin: 'https://gyca.test',
        getUserId: async request => request.headers.get('x-user') });
      const get = (actor = 'alice', query = '', competition = 'test') => handler(new Request(`https://gyca.test/api${query}`, {
        headers: actor === null ? {} : { 'x-user': actor },
      }), competition);
      assert.equal((await get(null)).status, 401);
      assert.equal((await get()).status, 403);
      await db.exec("INSERT INTO gyca_competition_editors VALUES('alice')");
      try {
        assert.equal((await get('alice', '', 'missing')).status, 404);
        assert.equal((await get('alice', '?limit=51')).status, 422);
        assert.deepEqual((await (await get()).json()).data.items, []);
        await fixture(); await fixture(); await fixture('payment_review');
        await worker().runOnce();
        const response = await get('alice', '?limit=1');
        assert.match(response.headers.get('cache-control'), /no-store/);
        const page = (await response.json()).data;
        assert.equal(page.items.length, 1); assert.ok(page.nextCursor);
        const second = (await (await get('alice', `?limit=1&cursor=${encodeURIComponent(page.nextCursor)}`)).json()).data;
        assert.equal(second.items.length, 1); assert.equal(second.nextCursor, null);
        const items = [...page.items, ...second.items];
        assert.ok(items.some(item => item.state === 'provider_accepted'));
        assert.ok(items.some(item => item.state === 'pending'));
        assert.doesNotMatch(JSON.stringify(items), /alice@example|email_payload|message-1/);
        assert.ok(items.every(item => item.allowedActions.length === 0));
        await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('other-mail-test','other-mail-test') ON CONFLICT DO NOTHING");
        assert.deepEqual((await (await get('alice', '', 'other-mail-test')).json()).data.items, []);
        await db.exec(`UPDATE "user" SET "emailVerified"=false;
          UPDATE gyca_payment_outbox SET email_state='stalled' WHERE kind='entry_received' AND email_state='pending'`);
        const stalled = (await (await get()).json()).data.items.find(item => item.state === 'stalled');
        assert.equal(stalled.emailVerified, false); assert.equal(stalled.nextAttemptAt, null);
        assert.equal(stalled.entryStatus, 'received');
      } finally { await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='alice'"); }
    });
    await t.test('sends only confirmed receipt and records provider acceptance once', async () => {
      await fixture(); await fixture('payment_review'); await fixture('entry_received', 'submitted');
      assert.deepEqual(await worker().runOnce(), { outcome: 'sent' });
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      assert.equal(sent.length, 1); assert.match(sent[0].payload.text, /GYCA-/);
    });
    await t.test('failed mail preserves receipt and retries frozen recipient with same idempotency key', async () => {
      const id = await fixture(); fail = true;
      assert.deepEqual(await worker().runOnce(), { outcome: 'retry_scheduled' });
      assert.equal((await db.query('SELECT status FROM gyca_entries WHERE id=$1', [id])).rows[0].status, 'received');
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      await db.exec(`UPDATE "user" SET email='changed@example.org'`); current += 30000; fail = false;
      assert.deepEqual(await worker().runOnce(), { outcome: 'sent' });
      assert.deepEqual(sent[0], sent[1]);
      await assert.rejects(db.query(`UPDATE gyca_payment_outbox SET email_payload='{}'`), /immutable/);
    });
    await t.test('late retries beyond provider retention are stopped', async () => {
      await fixture(); fail = true; await worker().runOnce();
      current += 24 * 3600000;
      assert.deepEqual(await worker().runOnce(), { outcome: 'stalled' }); assert.equal(sent.length, 1);
    });
    await t.test('expired lease is reclaimed and stale completion cannot overwrite the new result', async () => {
      await fixture();
      let release; let started;
      const ready = new Promise(resolve => { started = resolve; });
      const slow = { from: mailer.from, send: async () => { started(); return new Promise(resolve => { release = resolve; }); } };
      const original = createReceiptWorker(db, slow, () => new Date(current)).runOnce();
      await ready;
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      current += 120001;
      assert.deepEqual(await worker().runOnce(), { outcome: 'sent' });
      release('stale-provider-result');
      assert.deepEqual(await original, { outcome: 'superseded' });
      assert.equal((await db.query('SELECT email_provider_id FROM gyca_payment_outbox')).rows[0].email_provider_id, 'message-1');
    });
    await t.test('attempt limit prevents indefinite sending', async () => {
      const id = await fixture(); await db.query('UPDATE gyca_payment_outbox SET email_attempts=12 WHERE key=$1', [id]);
      assert.deepEqual(await worker().runOnce(), { outcome: 'stalled' }); assert.equal(sent.length, 0);
    });
    await t.test('unverified email and disabled mailer cannot send', async () => {
      await fixture(); await db.exec('UPDATE "user" SET "emailVerified"=false');
      assert.deepEqual(await worker().runOnce(), { outcome: 'idle' });
      await assert.rejects(createReceiptWorker(db, null, () => new Date(current)).runOnce(), { code: 'POLICY_NOT_CONFIGURED' });
    });
    await t.test('internal execution requires dedicated token', async () => {
      const handler = createRecoveryHandler({ enabled: true, token: 'x'.repeat(32), worker: worker() });
      const response = await handler(new Request('https://gyca.test/internal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }));
      assert.equal(response.status, 401); assert.equal(sent.length, 0);
    });
  } finally { await db.close(); }
});
test('Resend adapter fixes endpoint and preserves payload and idempotency header', async () => {
  assert.equal(configuredReceiptMailer({}), null);
  const payload = { from: 'receipts@example.org', to: ['alice@example.org'], subject: 'Receipt', text: 'Received' };
  const mailer = createResendMailer({ key: 're_fixture', from: payload.from }, async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers['Idempotency-Key'], 'stable-key'); assert.deepEqual(JSON.parse(init.body), payload);
    return Response.json({ id: 'accepted' });
  });
  assert.equal(await mailer.send(payload, 'stable-key'), 'accepted');
  const failing = createResendMailer({ key: 're_fixture', from: payload.from }, async () => new Response('secret', { status: 429 }));
  await assert.rejects(failing.send(payload, 'stable-key'), error => error.code === 'INTERNAL_ERROR' && !error.message.includes('secret'));
});
