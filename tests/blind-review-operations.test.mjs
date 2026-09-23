import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createJudgingService } from '../src/server/judging/service.ts';
import { createBlindAssetWorker } from '../src/server/judging/blind-worker.ts';

test('judge access and blind PDF approval preserve the manual review boundary', async () => {
  const db = new PGlite(); const at = new Date('2026-09-18T03:00:00Z'); const written = [];
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text NOT NULL,name text NOT NULL);
      INSERT INTO "user" VALUES('admin','admin@example.test','Admin'),('judge','judge@example.test','Judge'),('owner','owner@example.test','Owner');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query("INSERT INTO gyca_competitions(id,slug,phase,closes_at) VALUES('one','one','judging',$1)", [new Date(at.getTime() - 1000)]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    const sourceDoc = await PDFDocument.create(); sourceDoc.addPage(); sourceDoc.setAuthor('PRIVATE AUTHOR'); sourceDoc.setTitle('PRIVATE TITLE');
    const sourceBytes = await sourceDoc.save();
    const storage = { signCreate: async () => assert.fail(), readImmutable: async () => null,
      readVersion: async input => { assert.equal(input.version, 'source-version'); return { bytes: sourceBytes }; },
      writeImmutable: async input => { written.push(input); return { version: 'blind-version' }; },
      signDownload: async input => ({ url: `https://storage.test/${input.version}`, expiresAt: '2026-09-18T03:01:00.000Z' }) };
    const service = createJudgingService(db, storage, () => at);
    const judge = await service.updateJudge('admin', 'judge', { expectedActive: null, active: true, reason: 'first review panel' });
    assert.equal(judge.active, true); assert.equal((await service.listJudges('admin'))[0].email, 'judge@example.test');
    assert.equal((await service.updateJudge('admin', 'judge', { expectedActive: true, active: false, reason: 'pre-assignment check' })).active, false);
    await service.updateJudge('admin', 'judge', { expectedActive: false, active: true, reason: 'confirmed availability' });
    const rubric = { version: 'v1', editableAfterSubmit: false, criteria: [{ id: 'quality', label: 'Quality', description: '', maxScore: 10 }] };
    await service.updateRubric('admin', 'one', { competitionRevision: 1, rubric });
    const entry = randomUUID(); const source = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number) VALUES($1,'owner','one','received',$2,$2,'GYCA-1')", [entry, at]);
    await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'k','h',$2,$3,'{}')",
      [entry, at, { work: { category: 'book' }, ageGroup: 'youth' }]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,'pdf','h','book_pdf','private.pdf',$3,'application/pdf',100000,$4,'source-version',$5,'ready')`,
      [source, entry, sourceBytes.byteLength, `quarantine/${entry}/${source}`, at]);
    const assignment = await service.assign('admin', 'one', { entryId: entry, judgeId: 'judge', blindCode: 'BLIND-001', actionId: 'a1' });
    await assert.rejects(service.updateJudge('admin', 'judge', { expectedActive: true, active: false, reason: 'too early' }), { code: 'ENTRY_LOCKED' });
    assert.equal((await service.context('judge', assignment.id)).pdf, null);
    assert.deepEqual(await createBlindAssetWorker(db, storage, () => at).runOnce(), { outcome: 'completed' });
    assert.equal((await service.context('judge', assignment.id)).pdf, null, 'candidate is hidden until manual approval');
    const candidate = await service.getBlindAsset('admin', 'one', assignment.id);
    assert.equal(candidate.state, 'pending_review'); assert.equal(candidate.candidate.pageCount, 1);
    const rendered = await PDFDocument.load(written[0].bytes);
    assert.equal(rendered.getAuthor(), ''); assert.equal(rendered.getTitle(), '');
    await service.approveBlindAsset('admin', 'one', assignment.id, { candidateVersion: candidate.candidate.version,
      candidateChecksum: candidate.candidate.checksum, confirmedNoVisibleIdentity: true, note: 'all pages checked at 100%' });
    assert.equal((await service.context('judge', assignment.id)).pdf.url, 'https://storage.test/blind-version');
    await service.submit('judge', assignment.id, { expectedRevision: 0, draft: { scores: { quality: 8 }, comment: 'done' } });
    assert.equal((await service.updateJudge('admin', 'judge', { expectedActive: true, active: false, reason: 'panel finished' })).active, false);
    await assert.rejects(db.query('DELETE FROM gyca_blind_asset_approvals'), /immutable/);
  } finally { await db.close(); }
});

test('blind worker recovers an ambiguous create-only write only when stored bytes match', async () => {
  const db = new PGlite(); const at = new Date('2026-09-18T04:00:00Z'); let persisted = null;
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text NOT NULL,name text NOT NULL);
      INSERT INTO "user" VALUES('admin','admin@example.test','Admin'),('judge','judge@example.test','Judge'),('owner','owner@example.test','Owner');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query("INSERT INTO gyca_competitions(id,slug,phase,closes_at) VALUES('one','one','judging',$1)", [new Date(at.getTime() - 1)]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    await db.query("INSERT INTO gyca_judges(user_id,created_at) VALUES('judge',$1)", [at]);
    const document = await PDFDocument.create(); document.addPage(); const sourceBytes = await document.save();
    const serviceStorage = { signCreate: async () => assert.fail(), readImmutable: async () => null };
    const service = createJudgingService(db, serviceStorage, () => at);
    await service.updateRubric('admin', 'one', { competitionRevision: 1, rubric: { version: 'v1', editableAfterSubmit: false,
      criteria: [{ id: 'quality', label: 'Quality', description: '', maxScore: 10 }] } });
    const entry = randomUUID(); const source = randomUUID();
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number) VALUES($1,'owner','one','received',$2,$2,'GYCA-2')", [entry, at]);
    await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'k','h',$2,$3,'{}')",
      [entry, at, { work: { category: 'book' }, ageGroup: 'youth' }]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
      VALUES($1,$2,'pdf','h','book_pdf','private.pdf',$3,'application/pdf',100000,$4,'source-version',$5,'ready')`,
      [source, entry, sourceBytes.byteLength, `quarantine/${entry}/${source}`, at]);
    await service.assign('admin', 'one', { entryId: entry, judgeId: 'judge', blindCode: 'BLIND-002', actionId: 'a2' });
    const storage = { signCreate: async () => assert.fail(), readVersion: async () => ({ bytes: sourceBytes }),
      writeImmutable: async input => { persisted = input.bytes; throw new Error('response lost'); },
      readImmutable: async () => persisted && { bytes: persisted, version: 'recovered-version' } };
    assert.deepEqual(await createBlindAssetWorker(db, storage, () => at).runOnce(), { outcome: 'completed' });
    const row = (await db.query("SELECT state,candidate_version FROM gyca_blind_asset_jobs")).rows[0];
    assert.deepEqual(row, { state: 'pending_review', candidate_version: 'recovered-version' });
  } finally { await db.close(); }
});
