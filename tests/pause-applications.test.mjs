import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('pausing applications preserves payment gate and atomically records operator reason', async () => {
  const { createPauseApplicationsHandler } = await import('../src/server/competitions/pause-applications.ts');
  const { createResumeApplicationsHandler } = await import('../src/server/competitions/resume-applications.ts');
  const db = new PGlite();
  const now = () => new Date('2026-09-18T00:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('participant')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competition_editors VALUES('editor')`);
    const content = { title: { en: 'Test', ko: '테스트' }, fee: { amountMinor: 7000, currency: 'EUR' }, timezone: 'Asia/Seoul',
      keyDates: [], exhibition: null, guidelines: null, formSpec: { version: 'v1', ageReferenceDate: '2026-01-01',
        categories: [{ id: 'book', label: { en: 'Book', ko: '책' } }],
        ageGroups: [{ id: 'youth', label: { en: 'Youth', ko: '청소년' }, minAgeInclusive: 7, maxAgeInclusive: 18 }],
        fields: [{ path: 'participant.name', inputType: 'text', requiredOnSubmit: true }],
        uploads: [{ purpose: 'cover_image', requiredOnSubmit: true, allowedMediaTypes: ['image/png'], maxFiles: 1, maxBytes: 1024, minPages: null },
          { purpose: 'book_pdf', requiredOnSubmit: true, allowedMediaTypes: ['application/pdf'], maxFiles: 1, maxBytes: 1024, minPages: 20 }] } };
    await db.query(`INSERT INTO gyca_competitions(id,slug,draft_enabled,payment_enabled,published,opens_at,closes_at,payment_closes_at,public_content)
      VALUES('test','test',true,true,true,'2026-01-01Z','2027-01-01Z','2027-01-02Z',$1::jsonb)`, [JSON.stringify(content)]);
    const handler = createPauseApplicationsHandler({ database: db, now, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const resume = createResumeApplicationsHandler({ database: db, now, origin: 'https://gyca.test', getUserId: async req => req.headers.get('x-user') });
    const request = (body = { revision: 1, reason: 'Upload service incident' }, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
      method: 'POST', headers: { ...(actor ? { 'x-user': actor } : {}), origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await handler(request(undefined, null), 'test')).status, 401);
    assert.equal((await handler(request(undefined, 'participant'), 'test')).status, 403);
    assert.equal((await handler(request(undefined, 'editor', 'https://evil.test'), 'test')).status, 403);
    assert.equal((await handler(request({ revision: 1, reason: '' }), 'test')).status, 422);
    assert.equal((await handler(request(), 'missing')).status, 404);
    await db.exec(`CREATE FUNCTION fail_pause_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_pause_audit BEFORE INSERT ON gyca_application_pauses FOR EACH ROW EXECUTE FUNCTION fail_pause_audit()`);
    assert.equal((await handler(request(), 'test')).status, 500);
    assert.equal((await db.query('SELECT draft_enabled FROM gyca_competitions')).rows[0].draft_enabled, true);
    await db.exec('DROP TRIGGER fail_pause_audit ON gyca_application_pauses');
    const response = await handler(request(), 'test'); assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { competitionId: 'test', revision: 2, draftEnabled: false, paymentEnabled: true });
    assert.equal((await db.query('SELECT published FROM gyca_competitions')).rows[0].published, true);
    assert.equal((await handler(request(), 'test')).status, 409);
    const audit = (await db.query('SELECT reason,actor_id FROM gyca_application_pauses')).rows[0];
    assert.equal(audit.actor_id, 'editor'); assert.equal(audit.reason, 'Upload service incident');
    await assert.rejects(db.exec('DELETE FROM gyca_application_pauses'), /immutable/i);
    assert.equal((await resume(request({ revision: 2, reason: 'attempt' }, 'participant'), 'test')).status, 403);
    assert.equal((await resume(request({ revision: 2, reason: 'attempt' }, 'editor', 'https://evil.test'), 'test')).status, 403);
    assert.equal((await resume(request({ revision: 1, reason: 'stale' }), 'test')).status, 409);
    const resumed = await resume(request({ revision: 2, reason: 'Storage preflight recovered' }), 'test');
    assert.equal(resumed.status, 200);
    assert.deepEqual((await resumed.json()).data, { competitionId: 'test', revision: 3, draftEnabled: true, paymentEnabled: true });
    const resumeAudit = (await db.query('SELECT actor_id,reason,pause_revision FROM gyca_application_resumes')).rows[0];
    assert.deepEqual(resumeAudit, { actor_id: 'editor', reason: 'Storage preflight recovered', pause_revision: 2 });
    assert.equal((await resume(request({ revision: 3, reason: 'duplicate' }), 'test')).status, 409);
    await assert.rejects(db.exec('DELETE FROM gyca_application_resumes'), /immutable/i);
  } finally { await db.close(); }
});
