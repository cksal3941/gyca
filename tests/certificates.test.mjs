import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createCertificateHandlers } from '../src/server/certificates/service.ts';
import { createCertificateWorker } from '../src/server/certificates/worker.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';

test('certificate issuance is evidence-backed, durable and owner-only', async () => {
  const db = new PGlite(); const at = new Date('2027-01-11T03:00:00Z'); const objects = new Map();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('admin'),('owner'),('other');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,phase,public_content)
      VALUES('leipzig','leipzig',true,'result',$1)`, [{ title: { en: 'Leipzig International Artbook Competition', ko: '라이프치히 국제 아트북 공모전' } }]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    const entry = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number)
      VALUES($1,'owner','leipzig','received',$2,$2,'GYCA-2027-1')`, [entry, at]);
    const snapshot = { participant: { name: '홍길동', nameEn: 'Gildong Hong' },
      work: { title: '꿈', englishTitle: 'The Dream' }, assets: [], ageGroup: 'youth' };
    await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'submit','hash',$2,$3,'{}')",
      [entry, at, snapshot]);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,
      provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
      VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','test',false,'succeeded',$4,$3,$3)`,
    [randomUUID(), entry, at, `paid-${entry}`]);
    await db.query(`INSERT INTO gyca_result_round_publication_batches
      (competition_id,round,source_revision,resulting_revision,eligible_count,selected_count,actor_id,published_at)
      VALUES('leipzig','official_selection',1,2,1,1,'admin',$1)`, [at]);
    await db.query(`INSERT INTO gyca_entry_result_round_publications
      (competition_id,round,entry_id,result,review_revision,actor_id,published_at)
      VALUES('leipzig','official_selection',$1,'official_selection',1,'admin',$2)`, [entry, at]);
    await db.query("UPDATE gyca_entries SET published_result='official_selection' WHERE id=$1", [entry]);
    const storage = { signCreate: async () => assert.fail(),
      writeImmutable: async input => { assert.equal(input.mediaType, 'application/pdf'); objects.set(input.key, input.bytes); return { version: 'certificate-version' }; },
      readImmutable: async key => objects.has(key) ? { bytes: objects.get(key), version: 'certificate-version' } : null,
      signDownload: async input => ({ url: `https://storage.test/${input.version}`, expiresAt: '2027-01-11T03:01:00.000Z' }) };
    const handlers = createCertificateHandlers({ database: db, storage, now: () => at, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-user') });
    const issueBody = { entryIds: [entry], stage: 'official_selection', actionId: 'issue-official-1' };
    const issueRequest = () => new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-user': 'admin' }, body: JSON.stringify(issueBody) });
    const queuedResponse = await handlers.issue(issueRequest(), 'leipzig'); assert.equal(queuedResponse.status, 202);
    const queued = (await queuedResponse.json()).data;
    assert.equal(queued.requested, 1); assert.equal(queued.items[0].state, 'pending');
    assert.deepEqual((await (await handlers.issue(issueRequest(), 'leipzig')).json()).data, queued);
    const mine = () => handlers.listMine(new Request('https://gyca.test/api/certificates', { headers: { 'x-user': 'owner' } }));
    assert.deepEqual((await (await mine()).json()).data.items, []);
    assert.deepEqual(await createCertificateWorker(db, storage, () => at).runOnce(), { outcome: 'completed' });
    const stored = objects.values().next().value; const pdf = await PDFDocument.load(stored);
    assert.equal(pdf.getAuthor(), 'GYCA'); assert.equal(pdf.getPageCount(), 1);
    const certificates = (await (await mine()).json()).data.items;
    assert.equal(certificates.length, 1); assert.equal(certificates[0].entryId, entry);
    assert.equal(certificates[0].stage, 'official_selection'); assert.equal(certificates[0].workTitle, 'The Dream');
    assert.deepEqual(certificates[0].allowedActions, ['download_certificate']);
    const entryCertificates = await handlers.listEntry(new Request(`https://gyca.test/api/entries/${entry}/certificates`,
      { headers: { 'x-user': 'owner' } }), entry);
    assert.equal((await entryCertificates.json()).data.items.length, 1);
    assert.equal((await handlers.listEntry(new Request('https://gyca.test/api', { headers: { 'x-user': 'other' } }), entry)).status, 404);
    const download = await handlers.download(new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-user': 'owner' }, body: '{}' }), certificates[0].id);
    assert.equal(download.status, 200); assert.equal((await download.json()).data.url, 'https://storage.test/certificate-version');
    assert.equal((await handlers.download(new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-user': 'other' }, body: '{}' }), certificates[0].id)).status, 404);
    const detail = await createEntryRepository(db, () => at).get('owner', entry);
    assert.ok(detail.allowedActions.includes('download_certificate'));
    await assert.rejects(db.query('UPDATE gyca_entries SET certificate_count=0 WHERE id=$1', [entry]), /certificate evidence/);
    await assert.rejects(db.query('DELETE FROM gyca_certificate_events'), /immutable/);
  } finally { await db.close(); }
});
