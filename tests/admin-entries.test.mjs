import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('organizer entry list exposes operational state with stable filters, totals and keyset cursors', async () => {
  const { createAdminEntriesHandler } = await import('../src/server/entries/admin.ts');
  const db = new PGlite(); const base = new Date('2026-12-10T09:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor'),('owner')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_competitions(id,slug,phase) VALUES('one','one','result'),('two','two','scheduled')");
    const handler = createAdminEntriesHandler({ database: db, origin: 'https://gyca.test', now: () => new Date(),
      getUserId: async request => request.headers.get('x-test-user') });
    const get = (query = '', actor = 'editor', competition = 'one') => handler(new Request(`https://gyca.test/api${query}`, {
      headers: actor === null ? {} : { 'x-test-user': actor },
    }), competition);
    assert.equal((await get('', null)).status, 401); assert.equal((await get('', 'owner')).status, 403);
    assert.equal((await get('', 'editor', 'missing')).status, 404);
    for (const query of ['?limit=51','?cursor=bad','?entryStatus=paid','?paymentState=unknown','?publishedResult=unknown','?sort=id'])
      assert.equal((await get(query)).status, 422);
    const empty = (await (await get()).json()).data; assert.deepEqual(empty.items, []); assert.equal(empty.total, 0);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const statuses = ['draft', 'submitted', 'received']; const names = ['Zeta Artist', 'Beta Artist', 'Alpha Artist'];
    for (let i = 0; i < ids.length; i++) {
      const created = new Date(base.getTime() + i * 60000);
      await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,participant,guardian,created_at,submitted_at,received_at,receipt_number)
        VALUES($1,'owner','one',$2,$3,'{"email":"secret@example.org"}',$4,$5,$6,$7)`,
      [ids[i], statuses[i], { name: names[i], dateOfBirth: '2010-01-01' }, created, i ? created : null, i === 2 ? created : null, i === 2 ? 'GYCA-TEST' : null]);
      if (i > 0) {
        await db.query("INSERT INTO gyca_submissions VALUES($1,$2,'hash',$3,$4,'{}')", [ids[i], `submit-${i}`, created, {
          participant: { name: names[i] }, work: { englishTitle: 'Frozen title', title: '원제', category: 'artbook' }, ageGroup: 'youth', assets: [],
        }]);
        await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
          VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','private-mid',false,$4,$5,$6,$3)`,
        [randomUUID(), ids[i], created, i === 1 ? 'pending' : 'succeeded', i === 1 ? null : 'private-payment-key', i === 1 ? null : created]);
      }
    }
    await db.query("INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES($1,'owner','two')", [randomUUID()]);
    await db.query('UPDATE gyca_entries SET work=$1 WHERE id=$2', [{ englishTitle: ' ', title: '초안 제목', category: 'picturebook' }, ids[0]]);
    await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,expires_at,state,rejection_code)
      VALUES($1,$2,'asset','hash','book_pdf','bad.pdf',1,'application/pdf',10,$3,$4,'rejected','PDF_TOO_FEW_PAGES')`,
    [randomUUID(), ids[0], `quarantine/${ids[0]}/bad`, base]);
    await db.query(`INSERT INTO gyca_result_round_publication_batches
      (competition_id,round,source_revision,resulting_revision,eligible_count,selected_count,actor_id,published_at)
      VALUES('one','official_selection',1,2,1,1,'editor',$1)`, [base]);
    await db.query(`INSERT INTO gyca_entry_result_round_publications
      (competition_id,round,entry_id,result,review_revision,actor_id,published_at)
      VALUES('one','official_selection',$1,'official_selection',1,'editor',$2)`, [ids[2], base]);
    await db.query(`INSERT INTO gyca_entry_reviews(entry_id,review_status,decision,revision,updated_by,updated_at)
      VALUES($1,'completed','official_selection',1,'editor',$2)`, [ids[2], base]);
    await db.query("UPDATE gyca_entries SET review_status='completed',published_result='official_selection' WHERE id=$1", [ids[2]]);
    const response = await get('?limit=2'); assert.match(response.headers.get('cache-control'), /no-store/);
    const first = (await response.json()).data;
    assert.equal(first.total, 3); assert.equal(first.items.length, 2); assert.ok(first.nextCursor);
    assert.deepEqual(first.items.map(item => item.id), [ids[2], ids[1]], 'created_desc is the default');
    assert.equal(first.items[0].reviewStatus, 'completed'); assert.equal(first.items[0].publishedResult, 'official_selection');
    assert.equal(first.items[0].fileState, 'ready'); assert.equal(first.items[0].certificateIssued, false);
    assert.deepEqual(first.items[0].allowedActions, ['view_guardian_consents', 'issue_certificate']);
    assert.equal(first.items[1].payment.state, 'pending'); assert.equal(first.items[1].workTitle, 'Frozen title');
    const tail = (await (await get(`?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).json()).data;
    assert.equal(tail.total, 3); assert.deepEqual(tail.items.map(item => item.id), [ids[0]]); assert.equal(tail.nextCursor, null);
    assert.equal(tail.items[0].fileState, 'rejected'); assert.deepEqual(tail.items[0].allowedActions, []);
    assert.doesNotMatch(JSON.stringify({ first, tail }), /private-|secret@|dateOfBirth|"guardian":/);
    const query = async value => (await (await get(value)).json()).data;
    assert.equal((await query('?paymentState=succeeded')).total, 1);
    assert.equal((await query('?publishedResult=official_selection')).items[0].id, ids[2]);
    assert.equal((await query('?publishedResult=not_announced')).total, 2);
    assert.equal((await query('?q=gyca-test')).items[0].id, ids[2]);
    assert.equal((await query('?q=Frozen&entryStatus=submitted')).total, 1);
    assert.deepEqual((await query('?sort=name_asc')).items.map(item => item.participantName), ['Alpha Artist', 'Beta Artist', 'Zeta Artist']);
    assert.deepEqual((await query('?sort=created_asc')).items.map(item => item.id), ids);
    const certificateId = randomUUID();
    await db.query(`INSERT INTO gyca_certificates(id,entry_id,competition_id,stage,certificate_number,snapshot,state,object_key,
      object_version,checksum,due_at,issued_at,created_at) VALUES($1,$2,'one','official_selection',$3,$4,'issued',$5,'v1',$6,$7,$7,$7)`,
    [certificateId, ids[2], `GYCA-${certificateId}`, { recipientName: 'Alpha Artist', workTitle: 'Frozen title',
      competitionTitle: { en: 'One', ko: '원' }, stage: 'official_selection', certificateNumber: `GYCA-${certificateId}`, issueDate: '2026-12-10' },
    `certificates/${certificateId}.pdf`, 'a'.repeat(64), base]);
    await db.query('UPDATE gyca_entries SET certificate_count=1 WHERE id=$1', [ids[2]]);
    const certified = (await query('?publishedResult=official_selection')).items[0];
    assert.equal(certified.certificateIssued, true); assert.deepEqual(certified.allowedActions, ['view_guardian_consents']);
    for (const q of ['%', '_', "' OR 1=1 --", 'secret@example.org']) assert.equal((await query(`?q=${encodeURIComponent(q)}`)).total, 0);
    assert.equal((await get(`?q=${'x'.repeat(201)}`)).status, 422); assert.equal((await get('?q=one&q=two')).status, 422);
    assert.equal((await get(`?sort=name_asc&cursor=${encodeURIComponent(first.nextCursor)}`)).status, 422, 'cursor is bound to sort');
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'"); assert.equal((await get()).status, 403);
  } finally { await db.close(); }
});
