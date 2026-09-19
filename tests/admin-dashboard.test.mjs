import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('organizer dashboard reports bounded aggregate facts without exposing participant or payment identity', async () => {
  const { createAdminDashboardHandler } = await import('../src/server/admin/dashboard.ts');
  const db = new PGlite(); const at = new Date('2027-01-10T12:00:00.000Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text); INSERT INTO "user" VALUES
      ('editor','editor@example.org'),('owner-a','a@example.org'),('owner-b','b@example.org'),('outsider','outside@example.org')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec(`INSERT INTO gyca_competition_editors VALUES('editor');
      INSERT INTO gyca_competitions(id,slug,published,phase,public_content) VALUES
      ('a-contest','a-contest',true,'judging','{"title":{"en":"Contest A","ko":"공모 A"}}'),
      ('b-contest','b-contest',false,'scheduled',NULL)`);
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,participant,work,created_at,updated_at,submitted_at,review_status,published_result)
      VALUES($1,'owner-a','a-contest','submitted',$2,'{}',$4,$4,$4,'under_review',NULL),
        ($3,'owner-b','a-contest','received',$5,'{}',$4,$4,$4,'completed','official_selection')`,
    [ids[0], { name: 'Private A', residenceCountry: 'DE' }, ids[1], at, { name: 'Private B', residenceCountry: '' }]);
    const later = new Date(at.getTime() + 1000);
    await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,participant,work,created_at,updated_at)
      VALUES($1,'owner-a','b-contest','draft',$2,'{}',$3,$3)`, [ids[2], { name: 'New Private A', residenceCountry: 'KR' }, later]);
    for (const id of ids.slice(0, 2)) await db.query(
      `INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,$2,'hash',$3,$4,'{}')`,
      [id, `submit-${id}`, at, { participant: id === ids[0] ? { name: 'Frozen A', residenceCountry: 'DE' }
        : { name: 'Frozen B', residenceCountry: '' }, work: {}, guardian: {}, assets: [] }]);
    for (const [index, id] of ids.slice(0, 2).entries()) await db.query(`INSERT INTO gyca_orders
      (id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,needs_review,provider_payment_id,paid_at,created_at)
      VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','secret-merchant',false,'succeeded',$4,$5,$3,$3)`,
    [randomUUID(), id, at, index === 0, `secret-payment-${index}`]);
    await db.exec(`INSERT INTO gyca_judges(user_id,active,created_at) VALUES('outsider',true,'2027-01-10T12:00:00Z')`);
    const assignmentId = randomUUID();
    await db.query(`INSERT INTO gyca_judge_assignments(id,competition_id,entry_id,judge_id,blind_code,rubric_version,editable_after_submit,created_by,created_at)
      VALUES($1,'a-contest',$2,'outsider','BLIND-1','r1',false,'editor',$3)`, [assignmentId, ids[1], at]);
    await db.query(`INSERT INTO gyca_judge_reviews(assignment_id,revision,state,scores,comment,updated_at,submitted_at)
      VALUES($1,1,'submitted','{}','private comment',$2,$2)`, [assignmentId, at]);

    const handler = createAdminDashboardHandler({ database: db, origin: 'https://gyca.test', now: () => at,
      getUserId: async request => request.headers.get('x-test-user') });
    const get = (query = '', actor = 'editor') => handler(new Request(`https://gyca.test/api${query}`,
      { headers: actor === null ? {} : { 'x-test-user': actor } }));
    assert.equal((await get('', null)).status, 401); assert.equal((await get('', 'owner-a')).status, 403);
    for (const query of ['?limit=0','?limit=51','?unknown=1','?limit=1&limit=2']) assert.equal((await get(query)).status, 422);

    const firstResponse = await get('?limit=1'); assert.equal(firstResponse.status, 200);
    assert.match(firstResponse.headers.get('cache-control'), /private/); assert.match(firstResponse.headers.get('cache-control'), /no-store/);
    const first = (await firstResponse.json()).data;
    assert.deepEqual(first.accounts, { total: 4 });
    assert.equal(first.applicants.uniqueAccounts, 2); assert.equal(first.applicants.unknownResidenceCountry, 1);
    assert.deepEqual(first.applicants.byResidenceCountry, [{ country: 'KR', count: 1 }], 'latest entry determines account country');
    assert.equal(first.competitions.total, 2); assert.equal(first.competitions.items.length, 1); assert.equal(first.competitions.nextCursor, 'a-contest');
    const contest = first.competitions.items[0];
    assert.deepEqual(contest.title, { en: 'Contest A', ko: '공모 A' });
    assert.deepEqual(contest.entries, { total: 2, draft: 0, submitted: 1, received: 1, withdrawn: 0, expired: 0, uniqueApplicants: 2 });
    assert.equal(contest.payments.total, 2); assert.equal(contest.payments.succeeded, 2);
    assert.equal(contest.payments.needsReview, 1); assert.equal(contest.payments.succeededAmountMinor, 14000);
    assert.equal(contest.reviews.underReview, 1); assert.equal(contest.reviews.completed, 1);
    assert.equal(contest.reviews.activeAssignments, 1); assert.equal(contest.reviews.submittedAssignments, 1);
    assert.deepEqual(contest.results, { notAnnounced: 1, officialSelection: 1, finalist: 0, notSelected: 0 });
    assert.doesNotMatch(JSON.stringify(first), /Private|secret-|example\.org|comment/);

    const second = (await (await get(`?limit=1&cursor=${first.competitions.nextCursor}`)).json()).data;
    assert.equal(second.competitions.items[0].id, 'b-contest'); assert.equal(second.competitions.items[0].title, null);
    assert.equal(second.competitions.nextCursor, null); assert.equal(second.competitions.items[0].entries.draft, 1);
    await db.exec("DELETE FROM gyca_competition_editors WHERE user_id='editor'"); assert.equal((await get()).status, 403);
  } finally { await db.close(); }
});
