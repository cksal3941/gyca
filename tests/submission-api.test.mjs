import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createEntryRepository } from '../src/server/entries/repository.ts';
import { createEntryHandlers } from '../src/server/entries/http.ts';
import { createGuardianConsent } from '../src/server/notifications/guardian-consent.ts';
import { createGuardianHandlers } from '../src/server/notifications/guardian-http.ts';
import { createGuardianVerificationService } from '../src/server/notifications/guardian-verification.ts';
import { createGuardianVerificationHandler } from '../src/server/notifications/guardian-verification-http.ts';

test('submission HTTP flow freezes evidence without issuing a receipt', async (t) => {
  const db = new PGlite();
  const clock = () => new Date('2026-09-15T00:00:00Z');
  const store = createEntryRepository(db, clock);
  const handlers = createEntryHandlers({ repository: store, now: clock, origin: 'https://gyca.test',
    getUserId: async (req) => req.headers.get('x-test-user') });
  const request = (body, extra = {}, locale = 'en') => new Request(`https://gyca.test/?locale=${locale}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-test-user': 'alice', 'idempotency-key': 'submit-one', ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const policy = { enabled: true, version: 'test-policy', guardianAgeBasis: 'submission_date_in_competition_timezone', guardianAgeByCountry: { KR: 14 },
    documents: ['participation_rules', 'privacy', 'work_license'].map((kind) => ({ kind, version: 'v1',
      locale: 'en', title: kind, text: `Test fixture only: ${kind}` })) };
  const spec = { version: 'v1', ageReferenceDate: '2026-01-01',
    categories: [{ id: 'book', label: { en: 'Book', ko: '책' } }],
    ageGroups: [{ id: 'youth', label: { en: 'Youth', ko: '청소년' }, minAgeInclusive: 7, maxAgeInclusive: 18 }],
    fields: [{ path: 'participant.name', inputType: 'text', requiredOnSubmit: true }],
    uploads: [
      { purpose: 'cover_image', requiredOnSubmit: true, allowedMediaTypes: ['image/png'], maxFiles: 1, maxBytes: 100000, minPages: null },
      { purpose: 'book_pdf', requiredOnSubmit: true, allowedMediaTypes: ['application/pdf'], maxFiles: 1, maxBytes: 100000, minPages: 20 },
    ] };
  const content = { title: { en: 'Test', ko: '테스트' }, fee: { amountMinor: 7000, currency: 'EUR' },
    timezone: 'Asia/Seoul', keyDates: [], exhibition: null, guidelines: null, formSpec: spec };
  async function fixture(participant = {}) {
    const id = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,participant,work) VALUES($1,'alice','test',$2::jsonb,$3::jsonb)`,
      [id, JSON.stringify({ name: 'Test', dateOfBirth: '2010-01-01', residenceCountry: 'KR', ...participant }),
        JSON.stringify({ englishTitle: 'Book', englishDescription: 'Story', category: 'book' })]);
    for (const [purpose, mediaType, pages] of [['cover_image', 'image/png', null], ['book_pdf', 'application/pdf', 20]]) {
      await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,
        max_bytes,object_key,object_version,checksum,state,size_bytes,page_count,expires_at)
        VALUES($1,$2,$3,'hash',$3,$3,100,$4,100000,$5,'version-1',$6,'ready',100,$7,'2027-01-01Z')`,
        [randomUUID(), id, purpose, mediaType, randomUUID(), 'a'.repeat(64), pages]);
    }
    return id;
  }
  async function inputFor(id) {
    const response = await handlers.readiness(request(), id);
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    return { revision: data.revision, locale: 'en', policyToken: data.policyToken,
      consents: data.documents.map(({ kind, version }) => ({ kind, version, accepted: true })) };
  }
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'),(\'bob\'),(\'editor\');');
    for (const file of ['001_entries', '002_competitions', '003_uploads', '004_submissions', '005_payments', '011_competition_admin', '013_guardian_consent', '020_guardian_verifications'])
      await db.exec(await readFile(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,draft_enabled,opens_at,closes_at,payment_closes_at,public_content,submission_policy)
      VALUES('test','test',true,true,'2026-01-01Z','2027-01-01Z','2027-01-01Z',$1::jsonb,$2::jsonb)`, [JSON.stringify(content), JSON.stringify(policy)]);
    await t.test('returns server actions and separate consent documents', async () => {
      const response = await handlers.readiness(request(), await fixture());
      const data = (await response.json()).data;
      assert.deepEqual(data.allowedActions, ['submit']);
      assert.equal(data.documents.length, 3);
      assert.equal(data.ageGroup, 'youth');
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    });
    await t.test('guardian link records three consents without bypassing identity verification', async () => {
      const sent = []; let at = clock();
      const guardian = createGuardianConsent(db, { now: () => at, origin: 'https://gyca.test',
        mailer: { from: 'guardian@example.org', send: async payload => { sent.push(payload); return 'message'; } } });
      const api = createGuardianHandlers({ enabled: true, service: guardian, origin: 'https://gyca.test', now: () => at,
        getUserId: async req => req.headers.get('x-test-user') });
      const id = await fixture({ dateOfBirth: '2016-01-01' });
      await db.query(`UPDATE gyca_entries SET guardian='{"name":"Parent","email":"parent@example.org"}' WHERE id=$1`, [id]);
      await assert.rejects(guardian.request('bob', { entryId: id, revision: 1, locale: 'en' }), { code: 'NOT_FOUND' });
      const created = await guardian.request('alice', { entryId: id, revision: 1, locale: 'en' });
      assert.equal(created.state, 'pending'); assert.equal(JSON.stringify(created).includes('token'), false);
      const token = new URL(sent[0].text.split('\n').find(line => line.startsWith('https://'))).hash.slice(1);
      assert.equal((await guardian.preview(token)).documents.length, 3);
      await assert.rejects(guardian.preview('a'.repeat(64)), { code: 'NOT_FOUND' });
      const invalid = await api.accept(request({ token, guardianName: 'Parent', acceptedKinds: ['privacy'] }));
      assert.equal(invalid.status, 422);
      const accepted = await api.accept(request({ token, guardianName: 'Parent', acceptedKinds: ['privacy','participation_rules','work_license'] }));
      assert.equal(accepted.status, 200);
      assert.equal((await guardian.status('alice', id)).state, 'consented');
      await guardian.accept({ token, guardianName: 'Parent' });
      await assert.rejects(guardian.accept({ token, guardianName: 'Other' }), { code: 'IDEMPOTENCY_CONFLICT' });
      await assert.rejects(db.query('DELETE FROM gyca_guardian_consents'), /immutable/);
      assert.ok((await store.readiness('alice', id, 'en')).blockingReasons.includes('GUARDIAN_VERIFICATION_REQUIRED'));
      await assert.rejects(guardian.request('alice', { entryId: id, revision: 1, locale: 'en' }), { code: 'RATE_LIMITED' });
      at = new Date(at.getTime() + 61000);
      await guardian.request('alice', { entryId: id, revision: 1, locale: 'en' });
      await assert.rejects(guardian.preview(token), { code: 'CONSENT_REQUIRED' });
      const latest = new URL(sent[1].text.split('\n').find(line => line.startsWith('https://'))).hash.slice(1);
      await db.query('UPDATE gyca_entries SET revision=revision+1 WHERE id=$1', [id]);
      assert.equal((await guardian.status('alice', id)).state, 'stale');
      await assert.rejects(guardian.accept({ token: latest, guardianName: 'Parent' }), { code: 'CONSENT_REQUIRED' });
      at = new Date(at.getTime() + 86400000);
      assert.equal((await guardian.status('alice', id)).state, 'stale');

      const verifiedId = await fixture({ dateOfBirth: '2016-01-01' });
      await db.query(`UPDATE gyca_entries SET guardian='{"name":"Parent","email":"parent@example.org"}' WHERE id=$1`, [verifiedId]);
      const pending = await guardian.request('alice', { entryId: verifiedId, revision: 1, locale: 'en' });
      const verifiedToken = new URL(sent.at(-1).text.split('\n').find(line => line.startsWith('https://'))).hash.slice(1);
      await guardian.accept({ token: verifiedToken, guardianName: 'Parent' });
      const verification = createGuardianVerificationService(db, () => at);
      const verifyApi = createGuardianVerificationHandler({ service: verification, now: () => at, origin: 'https://gyca.test',
        getUserId: async req => req.headers.get('x-test-user') });
      const verifyRequest = (body, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/verify', {
        method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-test-user': actor }, body: JSON.stringify(body),
      });
      const verified = await verifyApi(verifyRequest({ entryRevision: 1, evidenceReference: 'OPS-2026-0001' }), 'test', verifiedId, pending.requestId);
      assert.equal(verified.status, 200);
      assert.deepEqual((await store.readiness('alice', verifiedId, 'en')).allowedActions, ['submit']);
      assert.equal((await verifyApi(verifyRequest({ entryRevision: 1, evidenceReference: 'changed' }), 'test', verifiedId, pending.requestId)).status, 409);
      assert.equal((await verifyApi(verifyRequest({ entryRevision: 1, evidenceReference: 'OPS-2026-0001' }, 'alice'), 'test', verifiedId, pending.requestId)).status, 403);
      assert.equal((await verifyApi(verifyRequest({ entryRevision: 1, evidenceReference: 'OPS-2026-0001' }, 'editor', 'https://evil.test'), 'test', verifiedId, pending.requestId)).status, 403);
      await assert.rejects(db.query('DELETE FROM gyca_guardian_verifications'), /immutable/);
    });
    await t.test('blocks missing English fields with field errors', async () => {
      const id = await fixture(); const input = await inputFor(id);
      await db.query(`UPDATE gyca_entries SET work=work || '{"englishTitle":" "}'::jsonb WHERE id=$1`, [id]);
      const response = await handlers.submit(request(input), id);
      assert.equal(response.status, 422);
      assert.deepEqual((await response.json()).error.fieldErrors, [{ path: 'work.englishTitle', code: 'REQUIRED' }]);
    });
    await t.test('blocks incomplete or altered files', async () => {
      for (const sql of ["state='validating'", "state='rejected',rejection_code='PDF_TOO_FEW_PAGES'",
        "object_version=NULL", "page_count=19", "removed_at=clock_timestamp()", "size_bytes=101"]) {
        const id = await fixture(); const input = await inputFor(id);
        await db.query(`UPDATE gyca_assets SET ${sql} WHERE entry_id=$1 AND purpose='book_pdf'`, [id]);
        assert.equal((await (await handlers.submit(request(input), id)).json()).error.code, 'FILE_NOT_READY');
      }
    });
    await t.test('requires trusted guardian verification and known country policy', async () => {
      for (const [participant, reason] of [[{ dateOfBirth: '2015-01-01' }, 'GUARDIAN_VERIFICATION_REQUIRED'],
        [{ residenceCountry: 'DE' }, 'POLICY_NOT_CONFIGURED']]) {
        const id = await fixture(participant);
        const data = (await (await handlers.readiness(request(), id)).json()).data;
        assert.deepEqual(data.allowedActions, []);
        assert.ok(data.blockingReasons.includes(reason));
      }
    });
    await t.test('computes age at the birthday boundary', async () => {
      const id = await fixture({ dateOfBirth: '2019-01-02' });
      const data = (await (await handlers.readiness(request(), id)).json()).data;
      assert.ok(data.fieldErrors.some((e) => e.code === 'AGE_OUT_OF_RANGE'));
    });
    await t.test('uses submission date for guardian age instead of the competition age reference', async () => {
      const id = await fixture({ dateOfBirth: '2012-09-15' });
      const data = (await (await handlers.readiness(request(), id)).json()).data;
      assert.deepEqual(data.allowedActions, ['submit']);
    });
    await t.test('blocks an unresolved fee or payment deadline before freezing a submission', async () => {
      const id = await fixture();
      await db.query('UPDATE gyca_competitions SET payment_closes_at=NULL');
      const data = (await (await handlers.readiness(request(), id)).json()).data;
      assert.deepEqual(data.allowedActions, []);
      assert.ok(data.blockingReasons.includes('POLICY_NOT_CONFIGURED'));
      await db.query("UPDATE gyca_competitions SET payment_closes_at='2027-01-01Z'");
    });
    await t.test('blocks unavailable consent translations', async () => {
      const data = (await (await handlers.readiness(request(undefined, {}, 'ko'), await fixture())).json()).data;
      assert.deepEqual(data.allowedActions, []); assert.deepEqual(data.documents, []);
    });
    await t.test('detects changed policy even with reused document version', async () => {
      const id = await fixture(); const input = await inputFor(id);
      await db.query(`UPDATE gyca_competitions SET submission_policy=jsonb_set(submission_policy,'{documents,0,text}','"Changed"')`);
      assert.equal((await (await handlers.submit(request(input), id)).json()).error.code, 'CONSENT_REQUIRED');
      await db.query('UPDATE gyca_competitions SET submission_policy=$1::jsonb', [JSON.stringify(policy)]);
    });
    await t.test('rejects forged evidence and duplicate or unaccepted consents', async () => {
      const id = await fixture(); const input = await inputFor(id);
      for (const body of [{ ...input, submittedAt: clock().toISOString() },
        { ...input, consents: [input.consents[0], input.consents[0], input.consents[0]] },
        { ...input, consents: input.consents.map((c) => ({ ...c, accepted: false })) }])
        assert.equal((await handlers.submit(request(body), id)).status, 422);
    });
    await t.test('rejects wrong consent versions', async () => {
      const id = await fixture(); const input = await inputFor(id);
      const response = await handlers.submit(request({ ...input, consents: input.consents.map((c) => ({ ...c, version: 'old' })) }), id);
      assert.equal((await response.json()).error.code, 'CONSENT_REQUIRED');
    });
    await t.test('enforces ownership, authentication and same origin', async () => {
      const id = await fixture(); const input = await inputFor(id);
      assert.equal((await handlers.submit(request(input, { 'x-test-user': 'bob' }), id)).status, 404);
      assert.equal((await handlers.readiness(request(undefined, { 'x-test-user': 'bob' }), id)).status, 404);
      assert.equal((await handlers.submit(request(input, { 'x-test-user': '' }), id)).status, 401);
      assert.equal((await handlers.submit(request(input, { origin: 'https://evil.test' }), id)).status, 403);
    });
    await t.test('rejects stale revision and the exact exclusive deadline', async () => {
      const id = await fixture(); const input = await inputFor(id);
      assert.equal((await (await handlers.submit(request({ ...input, revision: 2 }), id)).json()).error.code, 'REVISION_CONFLICT');
      const late = createEntryRepository(db, () => new Date('2027-01-01T00:00:00Z'));
      await assert.rejects(late.submit('alice', id, 'late', input), { code: 'DEADLINE_PASSED' });
      assert.equal((await store.get('alice', id)).entryStatus, 'draft');
    });
    await t.test('rolls back snapshot when entry update fails', async () => {
      const id = await fixture(); const input = await inputFor(id);
      await db.exec(`CREATE FUNCTION fail_submission_test() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'test rollback'; END; $$;
        CREATE TRIGGER test_fail BEFORE UPDATE ON gyca_entries FOR EACH ROW EXECUTE FUNCTION fail_submission_test();`);
      await assert.rejects(store.submit('alice', id, 'rollback', input), /test rollback/);
      await db.exec('DROP TRIGGER test_fail ON gyca_entries; DROP FUNCTION fail_submission_test();');
      assert.equal((await store.get('alice', id)).entryStatus, 'draft');
      assert.equal((await db.query('SELECT * FROM gyca_submissions WHERE entry_id=$1', [id])).rows.length, 0);
    });
    await t.test('submits once, replays after deadline, freezes content and exposes no receipt', async () => {
      const id = await fixture(); const input = await inputFor(id);
      const responses = await Promise.all([handlers.submit(request(input), id), handlers.submit(request(input), id)]);
      assert.deepEqual(responses.map((r) => r.status), [200, 200]);
      const bodies = await Promise.all(responses.map((r) => r.json()));
      assert.deepEqual(bodies[0].data, bodies[1].data);
      assert.equal(bodies[0].data.entryStatus, 'submitted'); assert.equal(bodies[0].data.receiptNumber, null);
      assert.equal(bodies[0].data.revision, 2);
      const saved = (await db.query('SELECT * FROM gyca_submissions WHERE entry_id=$1', [id])).rows[0];
      assert.equal(saved.snapshot.consents.length, 3); assert.equal(saved.snapshot.consents[0].actorId, 'alice');
      assert.equal(saved.snapshot.assets[0].object_version, 'version-1');
      assert.equal(saved.snapshot.competition.public_content.fee.amountMinor, 7000);
      const read = await store.get('alice', id);
      assert.equal(read.entryStatus, 'submitted'); assert.deepEqual(read.allowedActions, ['view_submission']);
      assert.equal(read.submittedAt, clock().toISOString());
      assert.equal(read.guardianVerification.status, 'not_required');
      assert.ok((await store.list('alice', null, 50)).items.some((e) => e.id === id));
      await assert.rejects(store.update('alice', id, { revision: 2, work: { title: 'changed' } }), { code: 'ENTRY_LOCKED' });
      await assert.rejects(db.query("UPDATE gyca_entries SET work='{}' WHERE id=$1", [id]), /immutable/);
      await assert.rejects(db.query("UPDATE gyca_submissions SET snapshot='{}' WHERE entry_id=$1", [id]), /immutable/);
      const later = createEntryRepository(db, () => new Date('2027-01-02Z'));
      assert.deepEqual(await later.submit('alice', id, 'submit-one', input), bodies[0].data);
      await assert.rejects(store.submit('alice', id, 'different-key', input), { code: 'IDEMPOTENCY_CONFLICT' });
      await assert.rejects(store.submit('alice', id, 'submit-one', { ...input, revision: 2 }), { code: 'IDEMPOTENCY_CONFLICT' });
    });
    await t.test('unconfigured submission policy remains closed', async () => {
      const id = await fixture(); await db.query('UPDATE gyca_competitions SET submission_policy=NULL');
      const data = (await (await handlers.readiness(request(), id)).json()).data;
      assert.deepEqual(data.allowedActions, []); assert.deepEqual(data.blockingReasons, ['POLICY_NOT_CONFIGURED']);
    });
  } finally { await db.close(); }
});
