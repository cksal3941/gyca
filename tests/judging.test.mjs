import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createJudgingService } from '../src/server/judging/service.ts';
import { createJudgingHandlers } from '../src/server/judging/http.ts';
import { createResultAdminHandlers } from '../src/server/entries/result-admin.ts';

test('judge assignments are blind, scoped and revision-safe with server-configured scoring', async () => {
  const db = new PGlite(); const at = new Date('2026-09-18T00:00:00Z'); const downloads = [];
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('admin'),('judge'),('other'),('owner');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query("INSERT INTO gyca_competitions(id,slug,phase,closes_at) VALUES('one','one','judging',$1)", [new Date(at.getTime() - 1000)]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    await db.query("INSERT INTO gyca_judges(user_id,created_at) VALUES('judge',$1)", [at]);
    const entry = randomUUID(); const source = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number) VALUES($1,'owner','one','received',$2,$2,'GYCA-1')", [entry, at]);
    await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'k','h',$2,$3,'{}')",
      [entry, at, { participant: { name: 'PRIVATE NAME', school: 'PRIVATE SCHOOL' }, work: { category: 'book', title: 'PRIVATE TITLE' }, ageGroup: 'youth' }]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,'pdf','h','book_pdf','private-name.pdf',3,'application/pdf',10,$3,'source-version',$4,'ready')`,
      [source, entry, `quarantine/${entry}/${source}`, at]);
    const storage = { signCreate: async () => assert.fail(), readImmutable: async () => null,
      signDownload: async input => { downloads.push(input); return { url: 'https://storage.test/blind', expiresAt: '2026-09-18T00:01:00Z' }; } };
    const service = createJudgingService(db, storage, () => at);
    const rubric = { version: 'rubric-v1', editableAfterSubmit: false, criteria: [
      { id: 'creativity', label: '창의성', description: '독창성', maxScore: 20 },
      { id: 'completeness', label: '완성도', description: '완성 수준', maxScore: 30 },
    ] };
    await assert.rejects(service.updateRubric('other', 'one', { competitionRevision: 1, rubric }), { code: 'FORBIDDEN' });
    const configured = await service.updateRubric('admin', 'one', { competitionRevision: 1, rubric });
    assert.equal(configured.competitionRevision, 2);
    const request = { entryId: entry, judgeId: 'judge', blindCode: 'L27-0421', actionId: 'assign-1' };
    const assignment = await service.assign('admin', 'one', request);
    assert.deepEqual(await service.assign('admin', 'one', request), assignment);
    assert.equal(assignment.reviewState, 'not_started'); assert.equal(JSON.stringify(assignment).includes('PRIVATE'), false);
    await assert.rejects(service.list('other'), { code: 'FORBIDDEN' });
    assert.deepEqual(await service.list('judge'), [assignment]);
    await assert.rejects(service.context('other', assignment.id), { code: 'NOT_FOUND' });
    const blocked = await service.context('judge', assignment.id);
    assert.equal(blocked.pdf, null); assert.deepEqual(blocked.blockingReasons, ['BLINDED_FILE_NOT_READY']);
    assert.doesNotMatch(JSON.stringify(blocked), /PRIVATE NAME|PRIVATE SCHOOL|PRIVATE TITLE|owner|payment|guardian/i);
    const saved = await service.save('judge', assignment.id, { expectedRevision: 0, draft: { scores: { creativity: 17 }, comment: '초안' } });
    assert.equal(saved.state, 'in_progress'); assert.equal(saved.revision, 1);
    assert.equal((await db.query('SELECT review_status FROM gyca_entries WHERE id=$1', [entry])).rows[0].review_status, 'under_review');
    const results = createResultAdminHandlers({ database: db, now: () => at, origin: 'https://gyca.test', getUserId: async () => 'admin' });
    const decide = body => results.updateReview(new Request('https://gyca.test/api', { method: 'PUT',
      headers: { origin: 'https://gyca.test', 'content-type': 'application/json' }, body: JSON.stringify(body) }), 'one', entry);
    assert.equal((await decide({ expectedRevision: 0, reviewStatus: 'completed', decision: 'official_selection' })).status, 409);
    await assert.rejects(service.submit('judge', assignment.id, { expectedRevision: 1, draft: { scores: { creativity: 17 }, comment: '누락' } }), { code: 'VALIDATION_FAILED' });
    await assert.rejects(service.submit('judge', assignment.id, { expectedRevision: 0, draft: { scores: { creativity: 17, completeness: 25 }, comment: '완료' } }), { code: 'REVISION_CONFLICT' });
    const submitted = await service.submit('judge', assignment.id, { expectedRevision: 1, draft: { scores: { creativity: 17, completeness: 25 }, comment: '완료' } });
    assert.equal(submitted.state, 'submitted'); assert.equal(submitted.revision, 2);
    assert.equal((await db.query('SELECT review_status FROM gyca_entries WHERE id=$1', [entry])).rows[0].review_status, 'completed');
    assert.equal((await decide({ expectedRevision: 0, reviewStatus: 'completed', decision: 'official_selection' })).status, 200);
    await assert.rejects(service.save('judge', assignment.id, { expectedRevision: 2, draft: { scores: {}, comment: '' } }), { code: 'ENTRY_LOCKED' });
    const derivative = randomUUID();
    await db.query(`INSERT INTO gyca_blinded_review_assets(assignment_id,source_asset_id,object_key,object_version,checksum,verified_at)
      VALUES($1,$2,$3,'blind-version','checksum',$4)`, [assignment.id, source, `quarantine/${entry}/${derivative}`, at]);
    const ready = await service.context('judge', assignment.id);
    assert.equal(ready.pdf.blindedName, 'L27-0421.pdf'); assert.deepEqual(ready.blockingReasons, []);
    assert.deepEqual(downloads, [{ key: `quarantine/${entry}/${derivative}`, version: 'blind-version' }]);
    await assert.rejects(db.query('DELETE FROM gyca_judge_review_changes'), /immutable/);
    const handlers = createJudgingHandlers({ service, now: () => at, origin: 'https://gyca.test', getUserId: async request => request.headers.get('x-user') });
    assert.equal((await handlers.save(new Request('https://gyca.test/api', { method: 'PUT', headers: { origin: 'https://evil.test', 'content-type': 'application/json', 'x-user': 'judge' }, body: '{}' }), assignment.id)).status, 403);
  } finally { await db.close(); }
});
