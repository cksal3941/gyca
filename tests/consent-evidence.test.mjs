import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createConsentEvidenceHandler } from '../src/server/entries/consent-evidence.ts';
import { createSubmissionRecordHandler } from '../src/server/entries/submission-record.ts';

test('organizer reads frozen three-part consent evidence without exposing the rest of submission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant'),('finance');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competitions(id,slug) VALUES('one','one'),('other','other');
      INSERT INTO gyca_competition_editors VALUES('editor');
      INSERT INTO gyca_payment_permissions VALUES('finance','one','operator');`);
    const id = randomUUID(); const draft = randomUUID(); const at = '2026-09-16T00:00:00.000Z';
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'participant','one'),($2,'participant','one')", [id, draft]);
    const consents = ['participation_rules','privacy','work_license'].map(kind => ({
      kind, version: 'original-v1', locale: 'ko', title: kind, text: 'Original consent text',
      textSha256: createHash('sha256').update('Original consent text').digest('hex'), actorId: 'participant', acceptedAt: at,
    }));
    const assetId = randomUUID();
    const snapshot = { consents, participant: { name: 'Original name' }, work: { title: 'Original title' }, ageGroup: 'youth',
      guardian: { email: 'SECRET_EMAIL' }, competition: { payment_routing: 'SECRET_ROUTING' },
      assets: [{ id: assetId, purpose: 'book_pdf', display_name: 'book.pdf', declared_type: 'application/pdf', size_bytes: 1234,
        page_count: 20, object_key: 'SECRET_STORAGE', object_version: 'SECRET_VERSION' }] };
    await db.query('INSERT INTO gyca_submissions VALUES($1,$2,$3,$4,$5,$6)',
      [id, 'private-request-key', 'private-request-hash', at, JSON.stringify(snapshot), '{}']);
    await db.query('UPDATE gyca_competitions SET submission_policy=$1 WHERE id=$2', [JSON.stringify({ version: 'new-policy' }), 'one']);
    const handler = createConsentEvidenceHandler({ database: db, now: () => new Date(at), origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const get = (actor, entryId = id, competition = 'one') => handler(new Request('https://gyca.test/api', { headers: actor ? { 'x-user': actor } : {} }), competition, entryId);
    assert.equal((await get(null)).status, 401);
    for (const actor of ['participant','finance']) assert.equal((await get(actor)).status, 403);
    const response = await get('editor'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const body = await response.json();
    assert.deepEqual(body.data, { entryId: id, submittedAt: at, consents });
    assert.doesNotMatch(JSON.stringify(body), /SECRET_|private-request|new-policy/);
    assert.equal((await get('editor', id, 'other')).status, 404);
    assert.equal((await get('editor', draft)).status, 404);
    assert.equal((await get('editor', randomUUID())).status, 404);
    assert.equal((await get('editor', 'invalid')).status, 422);
    const ownHandler = createSubmissionRecordHandler({ database: db, now: () => new Date(at), origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const ownGet = (actor, entry = id) => ownHandler(new Request('https://gyca.test/api', { headers: actor ? { 'x-user': actor } : {} }), entry);
    assert.equal((await ownGet(null)).status, 401);
    for (const actor of ['editor', 'finance']) assert.equal((await ownGet(actor)).status, 404);
    for (const entry of [draft, randomUUID()]) assert.equal((await ownGet('participant', entry)).status, 404);
    assert.equal((await ownGet('participant', 'invalid')).status, 422);
    await db.query('UPDATE gyca_entries SET participant=$1,work=$2 WHERE id=$3', ['{"name":"Changed fixture"}', '{"title":"Changed fixture"}', id]);
    const ownResponse = await ownGet('participant'); assert.equal(ownResponse.status, 200);
    assert.equal(ownResponse.headers.get('cache-control'), 'private, no-store');
    const own = (await ownResponse.json()).data;
    assert.deepEqual(own, { entryId: id, competitionId: 'one', submittedAt: at, consents, participant: snapshot.participant,
      work: snapshot.work, ageGroup: 'youth', assets: [{ id: assetId, purpose: 'book_pdf', displayName: 'book.pdf',
        mediaType: 'application/pdf', sizeBytes: 1234, pageCount: 20 }] });
    assert.doesNotMatch(JSON.stringify(own), /SECRET_|private-request|new-policy|Changed fixture/);
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'");
    assert.equal((await get('editor')).status, 403);
  } finally { await db.close(); }
});
