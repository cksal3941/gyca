import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createEntryExport } from '../src/server/entries/export.ts';
import { createEntryExportHandler } from '../src/server/entries/export-http.ts';

test('organizer CSV export is bounded, injection-safe and audited', async (t) => {
  const db = new PGlite(); const at = new Date('2026-09-19T00:00:00Z');
  const service = createEntryExport(db, () => at);
  const handler = createEntryExportHandler({ service, now: () => at, origin: 'https://gyca.test',
    getUserId: async request => request.headers.get('x-test-user') });
  const req = (body = {}, actor = 'editor', origin = 'https://gyca.test') => new Request('https://gyca.test/api', {
    method: 'POST', headers: { ...(actor ? { 'x-test-user': actor } : {}), origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      INSERT INTO "user" VALUES('editor','editor@example.org',true),('owner','=formula@example.org',true),('outsider','out@example.org',true)`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_competitions(id,slug) VALUES('one','one'),('two','two')");
    const ids = [randomUUID(), randomUUID()];
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,participant,work,guardian,created_at)
      VALUES($1,'owner','one','draft',$2,$3,$4,$5)`, [ids[0], { name: '=HYPERLINK("bad")', nameEn: 'Draft Name', dateOfBirth: '2010-01-01', residenceCountry: 'KR' },
      { englishTitle: '+SUM(1,1)', title: '초안', category: 'book' }, { name: '@guardian', email: '-guardian@example.org' }, at]);
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,participant,work,guardian,created_at,submitted_at,received_at,receipt_number,
      review_status,published_result) VALUES($1,'owner','one','received','{}','{}','{}',$2,$2,$2,'GYCA-ONE','completed','official_selection')`,
    [ids[1], new Date(at.getTime() + 1000)]);
    await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
      VALUES($1,'submit','hash',$2,$3::jsonb,'{}')`, [ids[1], at, JSON.stringify({ participant: { name: 'Frozen Artist', nameEn: 'Frozen Artist',
      dateOfBirth: '2011-02-03', residenceCountry: 'DE', school: 'School' }, work: { englishTitle: 'Frozen Work', title: '동결 작품', category: 'book' },
      guardian: { name: 'Guardian', email: 'guardian@example.org' }, ageGroup: 'youth' })]);
    await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,
      live_mode,state,provider_payment_id,paid_at,created_at) VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','fixture','private-mid',true,
      'succeeded','private-payment-key',$3,$3)`, [randomUUID(), ids[1], at]);

    await t.test('exports filtered frozen data with a fixed filename and no provider secrets', async () => {
      const response = await handler(req({ publishedResult: 'official_selection' }), 'one');
      assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
      assert.equal(response.headers.get('content-disposition'), 'attachment; filename="gyca-entries.csv"');
      assert.equal(response.headers.get('x-gyca-export-rows'), '1'); assert.ok(response.headers.get('x-gyca-export-id'));
      const bytes = Buffer.from(await response.arrayBuffer()); const csv = bytes.toString('utf8');
      assert.ok(csv.startsWith('\uFEFF')); assert.match(csv, /Frozen Artist/); assert.match(csv, /Frozen Work/);
      assert.doesNotMatch(csv, /private-mid|private-payment-key/);
      const audit = (await db.query('SELECT actor_id,row_count,content_sha256,filters FROM gyca_entry_exports')).rows[0];
      assert.equal(audit.actor_id, 'editor'); assert.equal(audit.row_count, 1);
      assert.equal(audit.content_sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(audit.filters.publishedResult, 'official_selection');
      await assert.rejects(db.query('DELETE FROM gyca_entry_exports'), /immutable/);
    });

    await t.test('neutralizes spreadsheet formulas in every untrusted cell', async () => {
      const response = await handler(req({ entryStatus: 'draft' }), 'one'); const csv = Buffer.from(await response.arrayBuffer()).toString('utf8');
      for (const protectedValue of ["'=HYPERLINK", "'=formula@example.org", "'+SUM", "'@guardian", "'-guardian@example.org"])
        assert.ok(csv.includes(protectedValue), protectedValue);
    });

    await t.test('enforces authentication, organizer scope, origin and strict filters', async () => {
      assert.equal((await handler(req({}, ''), 'one')).status, 401);
      assert.equal((await handler(req({}, 'outsider'), 'one')).status, 403);
      assert.equal((await handler(req({}, 'editor', 'https://evil.test'), 'one')).status, 403);
      assert.equal((await handler(req({ unknown: true }), 'one')).status, 422);
      assert.equal((await handler(req({ q: 'x'.repeat(201) }), 'one')).status, 422);
      assert.equal((await handler(req({}), 'missing')).status, 404);
    });
  } finally { await db.close(); }
});
