import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createJudgingService } from '../src/server/judging/service.ts';

test('admin assignment list, revocation and atomic reassignment preserve review history', async () => {
  const db = new PGlite(); const at = new Date('2026-09-19T00:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text NOT NULL,name text NOT NULL);
      INSERT INTO "user" VALUES
      ('admin','admin@example.test','Admin'),('old','old@example.test','Old Judge'),
      ('new','new@example.test','New Judge'),('owner','owner@example.test','Owner');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query("INSERT INTO gyca_competitions(id,slug,phase,closes_at) VALUES('one','one','judging',$1)", [new Date(at.getTime() - 1)]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    await db.query("INSERT INTO gyca_judges(user_id,created_at) VALUES('old',$1),('new',$1)", [at]);
    const storage = { signCreate: async () => assert.fail(), readImmutable: async () => null };
    const service = createJudgingService(db, storage, () => at);
    await service.updateRubric('admin', 'one', { competitionRevision: 1, rubric: { version: 'v1', editableAfterSubmit: false,
      criteria: [{ id: 'quality', label: 'Quality', description: '', maxScore: 10 }] } });
    async function createEntry(receipt) {
      const entry = randomUUID(); const asset = randomUUID();
      await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number) VALUES($1,'owner','one','received',$2,$2,$3)",
        [entry, at, receipt]);
      await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,$2,'h',$3,$4,'{}')",
        [entry, `submission-${entry}`, at, { work: { category: 'book' }, ageGroup: 'youth' }]);
      await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
        VALUES($1,$2,$3,'h','book_pdf','private.pdf',3,'application/pdf',10,$4,'source-version',$5,'ready')`,
        [asset, entry, `asset-${entry}`, `quarantine/${entry}/${asset}`, at]);
      return entry;
    }
    const firstEntry = await createEntry('GYCA-1');
    const first = await service.assign('admin', 'one', { entryId: firstEntry, judgeId: 'old', blindCode: 'BLIND-101', actionId: 'assign-1' });
    const firstPage = await service.listAdminAssignments('admin', 'one', { limit: 1, cursor: null });
    assert.equal(firstPage.items[0].receiptNumber, 'GYCA-1');
    assert.deepEqual(firstPage.items[0].allowedActions, ['revoke_assignment', 'reassign_assignment']);
    const revokeInput = { expectedReviewState: 'not_started', expectedReviewRevision: 0, reason: 'panel conflict', actionId: 'revoke-1' };
    const revoked = await service.revokeAssignment('admin', 'one', first.id, revokeInput);
    assert.deepEqual(await service.revokeAssignment('admin', 'one', first.id, revokeInput), revoked);
    assert.equal(revoked.replacement, null); assert.deepEqual(await service.list('old'), []);
    await assert.rejects(service.context('old', first.id), { code: 'NOT_FOUND' });
    assert.equal((await db.query('SELECT state,last_error_code FROM gyca_blind_asset_jobs WHERE assignment_id=$1', [first.id])).rows[0].state, 'stalled');

    const secondEntry = await createEntry('GYCA-2');
    const second = await service.assign('admin', 'one', { entryId: secondEntry, judgeId: 'old', blindCode: 'BLIND-102', actionId: 'assign-2' });
    await service.save('old', second.id, { expectedRevision: 0, draft: { scores: { quality: 7 }, comment: 'draft evidence' } });
    await assert.rejects(service.revokeAssignment('admin', 'one', second.id,
      { expectedReviewState: 'in_progress', expectedReviewRevision: 1, reason: 'cannot leave orphan', actionId: 'revoke-2' }));
    const reassignInput = { expectedReviewState: 'in_progress', expectedReviewRevision: 1, reason: 'judge unavailable',
      actionId: 'reassign-2', judgeId: 'new', blindCode: 'BLIND-202' };
    const changed = await service.reassignAssignment('admin', 'one', second.id, reassignInput);
    assert.deepEqual(await service.reassignAssignment('admin', 'one', second.id, reassignInput), changed);
    assert.equal(changed.replacement.code, 'BLIND-202');
    await assert.rejects(service.save('old', second.id, { expectedRevision: 1, draft: { scores: {}, comment: '' } }), { code: 'NOT_FOUND' });
    assert.equal((await service.list('new'))[0].id, changed.replacement.id);
    assert.equal((await db.query('SELECT comment FROM gyca_judge_reviews WHERE assignment_id=$1', [second.id])).rows[0].comment, 'draft evidence');
    const history = await service.listAdminAssignments('admin', 'one', { limit: 100, cursor: null });
    const oldRow = history.items.find(item => item.id === second.id); const replacementRow = history.items.find(item => item.id === changed.replacement.id);
    assert.equal(oldRow.revocationReason, 'judge unavailable'); assert.deepEqual(oldRow.allowedActions, []);
    assert.equal(replacementRow.reviewState, 'not_started');

    const thirdEntry = await createEntry('GYCA-3');
    const thirdOld = await service.assign('admin', 'one', { entryId: thirdEntry, judgeId: 'old', blindCode: 'BLIND-103', actionId: 'assign-3-old' });
    const thirdNew = await service.assign('admin', 'one', { entryId: thirdEntry, judgeId: 'new', blindCode: 'BLIND-203', actionId: 'assign-3-new' });
    await service.submit('old', thirdOld.id, { expectedRevision: 0, draft: { scores: { quality: 9 }, comment: 'complete' } });
    assert.equal((await db.query('SELECT review_status FROM gyca_entries WHERE id=$1', [thirdEntry])).rows[0].review_status, 'under_review');
    await service.revokeAssignment('admin', 'one', thirdNew.id,
      { expectedReviewState: 'not_started', expectedReviewRevision: 0, reason: 'duplicate panel slot', actionId: 'revoke-3' });
    assert.equal((await db.query('SELECT review_status FROM gyca_entries WHERE id=$1', [thirdEntry])).rows[0].review_status, 'completed');
    await assert.rejects(db.query('DELETE FROM gyca_judge_assignment_revocations'), /immutable/);
  } finally { await db.close(); }
});
