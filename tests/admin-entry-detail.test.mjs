import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createAdminEntryDetailHandler } from '../src/server/entries/admin-detail.ts';

test('organizer detail uses frozen evidence and omits private provider and storage fields', async () => {
  const db = new PGlite(); const at = new Date('2027-01-12T02:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('owner'),('other');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.query("INSERT INTO gyca_competitions(id,slug,phase,public_content) VALUES('one','one','result',$1)",
      [{ title: { en: 'Competition One', ko: '공모전 원' } }]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor')");
    const entry = randomUUID(); const asset = randomUUID();
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,revision,participant,work,guardian,created_at,submitted_at,received_at,receipt_number)
      VALUES($1,'owner','one','received',2,$2,$3,$4,$5,$5,$5,'GYCA-DETAIL')`, [entry,
      { name: 'Changed Name' }, { englishTitle: 'Changed Work' }, { email: 'guardian-private@example.test' }, at]);
    const documents = ['participation_rules', 'privacy', 'work_license'].map(kind => ({ kind, version: '2027.1', locale: 'en',
      title: `${kind} title`, text: `private full ${kind} text`, textSha256: createHash('sha256').update(kind).digest('hex'),
      actorId: 'owner', acceptedAt: at.toISOString() }));
    const snapshot = { participant: { name: 'Frozen Name', nameEn: 'Frozen Name', dateOfBirth: '2010-01-01', residenceCountry: 'KR' },
      work: { title: '동결 작품', englishTitle: 'Frozen Work', category: 'artbook' }, ageGroup: 'youth', consents: documents,
      assets: [{ id: asset, purpose: 'book_pdf', display_name: 'frozen.pdf', declared_type: 'application/pdf', size_bytes: 1024,
        page_count: 24, state: 'ready', object_key: 'private/object/key', object_version: 'private-version' }] };
    await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,'submit','hash',$2,$3,'{}')",
      [entry, at, snapshot]);
    const order = randomUUID();
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,
      merchant_account,live_mode,state,provider_payment_id,paid_at,created_at) VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at',
      'test-provider','private-mid',false,'succeeded','private-payment-key',$3,$3)`, [order, entry, at]);
    const guardianRequest = randomUUID();
    await db.query(`INSERT INTO gyca_guardian_requests(id,entry_id,token_hash,entry_revision,policy_token,locale,recipient,documents,created_at,expires_at)
      VALUES($1,$2,'private-token-hash',1,'policy','en','guardian-private@example.test',$3,$4,$5)`,
    [guardianRequest, entry, documents.map(({ kind, version, locale, title, text }) => ({ kind, version, locale, title, text })), at, new Date(at.getTime() + 86400000)]);
    await db.query("INSERT INTO gyca_guardian_consents VALUES($1,'Private Guardian',$2)", [guardianRequest, at]);
    await db.query("INSERT INTO gyca_guardian_verifications VALUES($1,$2,1,'policy','editor','internal-review-reference',$3)",
      [guardianRequest, entry, at]);
    await db.query(`INSERT INTO gyca_entry_reviews VALUES($1,'completed','official_selection',1,'editor',$2)`, [entry, at]);
    await db.query(`INSERT INTO gyca_entry_review_changes VALUES($1,1,'editor','completed','official_selection',$2)`, [entry, at]);
    await db.query(`INSERT INTO gyca_result_round_publication_batches VALUES('one','official_selection',1,2,1,1,'editor',$1)`, [at]);
    await db.query(`INSERT INTO gyca_entry_result_round_publications VALUES('one','official_selection',$1,'official_selection',1,'editor',$2)`, [entry, at]);
    await db.query("UPDATE gyca_entries SET review_status='completed',published_result='official_selection' WHERE id=$1", [entry]);
    const certificate = randomUUID(); const batch = randomUUID();
    await db.query(`INSERT INTO gyca_certificate_issue_batches VALUES($1,'editor','detail-cert','hash','one','official_selection',1,$2)`, [batch, at]);
    await db.query(`INSERT INTO gyca_certificates(id,entry_id,competition_id,stage,certificate_number,snapshot,state,object_key,object_version,
      checksum,due_at,issued_at,created_at) VALUES($1,$2,'one','official_selection',$3,$4,'issued',$5,'private-certificate-version',$6,$7,$7,$7)`,
    [certificate, entry, `GYCA-${certificate}`, { recipientName: 'Frozen Name', workTitle: 'Frozen Work',
      competitionTitle: { en: 'Competition One', ko: '공모전 원' }, stage: 'official_selection', certificateNumber: `GYCA-${certificate}`,
      issueDate: '2027-01-12' }, `certificates/${certificate}.pdf`, 'a'.repeat(64), at]);
    await db.query("INSERT INTO gyca_certificate_issue_batch_items VALUES($1,$2)", [batch, certificate]);
    await db.query("INSERT INTO gyca_certificate_events VALUES($1,$2,1,'issued',NULL,$3)", [randomUUID(), certificate, at]);
    await db.query("UPDATE gyca_entries SET certificate_count=1 WHERE id=$1", [entry]);
    const handler = createAdminEntryDetailHandler({ database: db, now: () => at, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-user') });
    const call = (actor = 'editor', competition = 'one', id = entry) => handler(new Request('https://gyca.test/api', {
      headers: actor ? { 'x-user': actor } : {},
    }), competition, id);
    assert.equal((await call(null)).status, 401); assert.equal((await call('other')).status, 403);
    assert.equal((await call('editor', 'missing')).status, 404); assert.equal((await call('editor', 'one', randomUUID())).status, 404);
    const response = await call(); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    const detail = (await response.json()).data;
    assert.equal(detail.participant.name, 'Frozen Name'); assert.equal(detail.work.englishTitle, 'Frozen Work');
    assert.equal(detail.workTitle, 'Frozen Work'); assert.equal(detail.ageGroup, 'youth'); assert.equal(detail.fileState, 'ready');
    assert.deepEqual(detail.files, [{ id: asset, purpose: 'book_pdf', displayName: 'frozen.pdf', mediaType: 'application/pdf',
      sizeBytes: 1024, pageCount: 24, state: 'ready', rejectionCode: null }]);
    assert.equal(detail.guardianVerificationStatus, 'verified'); assert.equal(detail.consents.length, 3);
    assert.equal(detail.certificates[0].state, 'issued'); assert.equal(detail.certificateIssued, true);
    assert.deepEqual(detail.allowedActions, ['view_guardian_consents']);
    assert.ok(detail.audit.some(event => event.type === 'entry.submitted'));
    assert.ok(detail.audit.some(event => event.type === 'payment.succeeded'));
    assert.ok(detail.audit.some(event => event.type === 'result.published'));
    assert.ok(detail.audit.some(event => event.type === 'certificate.issued'));
    assert.doesNotMatch(JSON.stringify(detail), /Changed Name|Changed Work|private-|full privacy text|guardian-private|internal-review-reference/);
  } finally { await db.close(); }
});
