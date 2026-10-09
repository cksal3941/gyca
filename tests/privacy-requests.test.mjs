import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('privacy requests are owner-scoped, revision-safe and stop before claiming erasure completion', async () => {
  const { createPrivacyRequestService } = await import('../src/server/privacy/service.ts');
  const { createPrivacyRequestHandlers } = await import('../src/server/privacy/http.ts');
  const db = new PGlite(); let tick = 0; const now = () => new Date(Date.parse('2027-01-01T00:00:00Z') + tick++ * 1000);
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text NOT NULL); INSERT INTO "user" VALUES
      ('owner','owner@example.org'),('other','other@example.org'),('admin','admin@example.org')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    const handlers = createPrivacyRequestHandlers({ service: createPrivacyRequestService(db, now), now,
      origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-test-user') });
    const send = (method, url, actor, body, origin = 'https://gyca.test') => handlers[method](new Request(`https://gyca.test${url}`, {
      method: method === 'list' || method === 'listAdmin' ? 'GET' : 'POST',
      headers: { ...(actor ? { 'x-test-user': actor } : {}), ...(body ? { 'content-type': 'application/json' } : {}),
        ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined,
    }), ...(method === 'cancel' || method === 'review' ? [url.split('/').at(-2)] : []));

    const createBody = { actionId: randomUUID(), kind: 'account_closure_and_erasure' };
    assert.equal((await send('create', '/api/v1/privacy/requests', null, createBody)).status, 401);
    assert.equal((await send('create', '/api/v1/privacy/requests', 'owner', createBody, 'https://evil.test')).status, 403);
    const createdResponse = await send('create', '/api/v1/privacy/requests', 'owner', createBody);
    assert.equal(createdResponse.status, 201); const created = (await createdResponse.json()).data;
    assert.equal(created.state, 'submitted'); assert.equal(created.revision, 1);
    assert.deepEqual(created.allowedActions, ['cancel_privacy_request']);
    const replay = (await (await send('create', '/api/v1/privacy/requests', 'owner', createBody)).json()).data;
    assert.deepEqual(replay, created);
    assert.equal((await send('create', '/api/v1/privacy/requests', 'owner', { ...createBody, actionId: randomUUID() })).status, 409);
    const mine = await handlers.list(new Request('https://gyca.test/api/v1/privacy/requests?limit=20', { headers: { 'x-test-user': 'owner' } }));
    assert.equal(mine.status, 200); const mineData = (await mine.json()).data;
    assert.equal(mineData.items.length, 1); assert.doesNotMatch(JSON.stringify(mineData), /owner@example|accountId/);
    assert.equal((await handlers.list(new Request('https://gyca.test/api/v1/privacy/requests?unknown=1', { headers: { 'x-test-user': 'owner' } }))).status, 422);

    assert.equal((await handlers.listAdmin(new Request('https://gyca.test/api/v1/admin/privacy-requests', { headers: { 'x-test-user': 'other' } }))).status, 403);
    const adminList = await handlers.listAdmin(new Request('https://gyca.test/api/v1/admin/privacy-requests?state=submitted&limit=20',
      { headers: { 'x-test-user': 'admin' } }));
    const adminItem = (await adminList.json()).data.items[0]; assert.equal(adminItem.requester.email, 'owner@example.org');
    assert.deepEqual(adminItem.allowedActions, ['start_review']); assert.equal(adminItem.lastTransition.reasonCode, 'USER_REQUESTED');

    const startAction = randomUUID();
    const wrongRevision = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: startAction, expectedRevision: 2, decision: 'start_review' }) }), created.id);
    assert.equal(wrongRevision.status, 409);
    const start = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: startAction, expectedRevision: 1, decision: 'start_review' }) }), created.id);
    assert.equal(start.status, 200); const reviewing = (await start.json()).data;
    assert.equal(reviewing.state, 'under_review'); assert.deepEqual(reviewing.allowedActions, ['place_retention_hold', 'approve_for_execution']);
    const lateCancel = await handlers.cancel(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'owner', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: randomUUID(), expectedRevision: 2 }) }), created.id);
    assert.equal(lateCancel.status, 409);

    const holdAction = randomUUID(); const holdBody = { actionId: holdAction, expectedRevision: 2, decision: 'place_retention_hold',
      reasonCode: 'PAYMENT_RECORD_RETENTION', evidenceReference: 'policy-case-2027-001' };
    const hold = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' }, body: JSON.stringify(holdBody) }), created.id);
    const held = (await hold.json()).data; assert.equal(held.state, 'retention_hold'); assert.deepEqual(held.allowedActions, ['resume_review']);
    assert.equal(held.lastTransition.evidenceReference, 'policy-case-2027-001');
    const changedReplay = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ ...holdBody, evidenceReference: 'changed' }) }), created.id);
    assert.equal(changedReplay.status, 409);
    const resume = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: randomUUID(), expectedRevision: 3, decision: 'resume_review' }) }), created.id);
    assert.equal((await resume.json()).data.state, 'under_review');
    const approve = await handlers.review(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'admin', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: randomUUID(), expectedRevision: 4, decision: 'approve_for_execution',
        reasonCode: 'NO_RETENTION_BLOCK', evidenceReference: 'review-case-2027-001' }) }), created.id);
    const approved = (await approve.json()).data; assert.equal(approved.state, 'approved_for_execution');
    assert.deepEqual(approved.allowedActions, []); assert.doesNotMatch(JSON.stringify(approved), /completed|deleted/);
    assert.equal((await handlers.listAdmin(new Request('https://gyca.test/api?state=completed', { headers: { 'x-test-user': 'admin' } }))).status, 422);

    await assert.rejects(db.exec(`UPDATE gyca_privacy_requests SET state='cancelled',revision=revision+1`));
    await assert.rejects(db.exec(`UPDATE gyca_privacy_request_transitions SET reason_code='USER_CANCELLED'`));
    await assert.rejects(db.exec(`DELETE FROM gyca_privacy_request_actions`));
    const cancelledOwner = { actionId: randomUUID(), kind: 'account_closure_and_erasure' };
    const otherCreated = (await (await send('create', '/api/v1/privacy/requests', 'other', cancelledOwner)).json()).data;
    const cancelled = await handlers.cancel(new Request('https://gyca.test/api', { method: 'POST', headers: {
      'x-test-user': 'other', origin: 'https://gyca.test', 'content-type': 'application/json' },
      body: JSON.stringify({ actionId: randomUUID(), expectedRevision: 1 }) }), otherCreated.id);
    assert.equal((await cancelled.json()).data.state, 'cancelled');
    assert.equal((await send('create', '/api/v1/privacy/requests', 'other', { actionId: randomUUID(), kind: 'account_closure_and_erasure' })).status, 201);
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='admin'");
    assert.equal((await handlers.listAdmin(new Request('https://gyca.test/api', { headers: { 'x-test-user': 'admin' } }))).status, 403);
  } finally { await db.close(); }
});
