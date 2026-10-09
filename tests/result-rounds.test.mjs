import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createResultAdminHandlers } from '../src/server/entries/result-admin.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';

test('staged result publication hides finalists until round two and separates participation confirmation', async () => {
  const db = new PGlite(); const at = new Date('2026-09-19T01:00:00Z');
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('admin'),('owner-a'),('owner-b'),('owner-c');`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    const policy = { enabled: true, version: 'retention-v3', withdrawnDraftAssets: { deleteAfterDays: 7 },
      unselectedSubmissionAssets: { deleteAfterDays: 30 }, selectedSubmissionAssets: { deleteAfterDays: 365 },
      consentEvidence: { retainDays: 365 }, paymentEvidence: { retainDays: 1825 } };
    await db.query(`INSERT INTO gyca_competitions(id,slug,published,closes_at,phase,retention_policy)
      VALUES('one','one',true,$1,'judging',$2)`, [new Date(at.getTime() - 1), policy]);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('admin')");
    const entries = [];
    for (const [owner, receipt] of [['owner-a', 'GYCA-A'], ['owner-b', 'GYCA-B'], ['owner-c', 'GYCA-C']]) {
      const entry = randomUUID(); const asset = randomUUID(); entries.push({ owner, entry, asset });
      await db.query(`INSERT INTO gyca_entries(id,owner_id,competition_id,status,submitted_at,received_at,receipt_number)
        VALUES($1,$2,'one','received',$3,$3,$4)`, [entry, owner, at, receipt]);
      await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,$2,'h',$3,'{}','{}')", [entry, entry, at]);
      await db.query(`INSERT INTO gyca_assets(id,entry_id,request_key,request_hash,purpose,display_name,declared_size,declared_type,max_bytes,object_key,object_version,expires_at,state)
        VALUES($1,$2,$3,'h','book_pdf','book.pdf',3,'application/pdf',10,$4,$5,$6,'ready')`,
        [asset, entry, asset, `quarantine/${entry}/${asset}`, `version-${asset}`, at]);
      await db.query(`INSERT INTO gyca_orders(id,entry_id,amount_minor,currency,payment_closes_at,policy_version,approval_basis,provider,merchant_account,live_mode,state,provider_payment_id,paid_at,created_at)
        VALUES($1,$2,7000,'EUR',$3,'v1','provider_paid_at','test','test',false,'succeeded',$4,$3,$3)`,
        [randomUUID(), entry, at, `paid-${entry}`]);
    }
    const handlers = createResultAdminHandlers({ database: db, now: () => at, origin: 'https://gyca.test',
      getUserId: async request => request.headers.get('x-user') });
    const mutate = (entry, body) => handlers.updateReview(new Request('https://gyca.test/api', { method: 'PUT',
      headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-user': 'admin' }, body: JSON.stringify(body) }), 'one', entry);
    const publish = (round, revision) => handlers.publishRound(new Request('https://gyca.test/api', { method: 'POST',
      headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-user': 'admin' },
      body: JSON.stringify({ competitionRevision: revision }) }), 'one', round);
    assert.equal((await mutate(entries[0].entry, { expectedRevision: 0, reviewStatus: 'completed', decision: 'official_selection' })).status, 200);
    assert.equal((await mutate(entries[1].entry, { expectedRevision: 0, reviewStatus: 'completed', decision: 'official_selection' })).status, 200);
    assert.equal((await mutate(entries[2].entry, { expectedRevision: 0, reviewStatus: 'completed', decision: 'not_selected' })).status, 200);
    assert.equal((await publish('finalist', 1)).status, 409);
    const first = (await (await publish('official_selection', 1)).json()).data;
    assert.deepEqual({ round: first.round, eligibleCount: first.eligibleCount, selectedCount: first.selectedCount, resultingRevision: first.resultingRevision },
      { round: 'official_selection', eligibleCount: 3, selectedCount: 2, resultingRevision: 2 });
    const repository = createEntryRepository(db, () => at);
    assert.equal((await repository.get('owner-a', entries[0].entry)).publishedResult, 'official_selection');
    assert.equal((await repository.get('owner-b', entries[1].entry)).publishedResult, 'official_selection');
    assert.equal((await repository.get('owner-c', entries[2].entry)).publishedResult, 'not_selected');
    assert.equal((await repository.get('owner-b', entries[1].entry)).finalParticipation.state, 'not_available');
    assert.equal((await mutate(entries[2].entry, { expectedRevision: 1, reviewStatus: 'completed', decision: 'finalist' })).status, 409);
    assert.equal((await mutate(entries[1].entry, { expectedRevision: 1, reviewStatus: 'completed', decision: 'finalist' })).status, 200);
    const second = (await (await publish('finalist', 2)).json()).data;
    assert.deepEqual({ round: second.round, eligibleCount: second.eligibleCount, selectedCount: second.selectedCount, resultingRevision: second.resultingRevision },
      { round: 'finalist', eligibleCount: 2, selectedCount: 1, resultingRevision: 3 });
    const finalist = await repository.get('owner-b', entries[1].entry);
    assert.equal(finalist.publishedResult, 'finalist'); assert.equal(finalist.finalParticipation.state, 'invited');
    assert.equal(finalist.finalParticipation.revision, 1); assert.equal(finalist.finalParticipation.orderId, null);
    assert.deepEqual(finalist.finalParticipation.allowedActions, ['respond_final_participation']);
    assert.equal((await repository.get('owner-a', entries[0].entry)).publishedResult, 'official_selection');
    const respondBody = { expectedRevision: 1, response: 'accept', actionId: 'participant-response-1' };
    const respondRequest = () => new Request('https://gyca.test/api', { method: 'POST', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-user': 'owner-b' }, body: JSON.stringify(respondBody) });
    const pending = (await (await handlers.respondFinalParticipation(respondRequest(), entries[1].entry)).json()).data;
    assert.equal(pending.state, 'confirmation_pending'); assert.equal(pending.revision, 2);
    assert.deepEqual((await (await handlers.respondFinalParticipation(respondRequest(), entries[1].entry)).json()).data, pending);
    const confirmBody = { expectedRevision: 2, state: 'confirmed', reason: 'eligibility checked', actionId: 'admin-confirm-1' };
    const confirmRequest = () => new Request('https://gyca.test/api', { method: 'PUT', headers: { origin: 'https://gyca.test',
      'content-type': 'application/json', 'x-user': 'admin' }, body: JSON.stringify(confirmBody) });
    const confirmed = (await (await handlers.updateFinalParticipation(confirmRequest(), 'one', entries[1].entry)).json()).data;
    assert.equal(confirmed.state, 'confirmed'); assert.equal(confirmed.revision, 3); assert.equal(confirmed.orderId, null);
    const confirmedEntry = await repository.get('owner-b', entries[1].entry);
    assert.equal(confirmedEntry.finalParticipation.state, 'confirmed'); assert.deepEqual(confirmedEntry.finalParticipation.allowedActions, []);
    await assert.rejects(db.query(`UPDATE gyca_entries SET final_participation_state='declined',
      final_participation_confirmed_at=NULL WHERE id=$1`, [entries[1].entry]), /participation evidence/);
    assert.equal((await handlers.respondFinalParticipation(new Request('https://gyca.test/api', { method: 'POST', headers: {
      origin: 'https://gyca.test', 'content-type': 'application/json', 'x-user': 'owner-a' }, body: JSON.stringify(respondBody) }), entries[0].entry)).status, 404);
    const jobs = (await db.query('SELECT reason,count(*)::integer AS count FROM gyca_asset_deletion_jobs GROUP BY reason ORDER BY reason')).rows;
    assert.deepEqual(jobs, [{ reason: 'selected_submission', count: 2 }, { reason: 'unselected_submission', count: 1 }]);
    await assert.rejects(db.query('DELETE FROM gyca_entry_result_round_publications'), /immutable/);
    await assert.rejects(db.query('DELETE FROM gyca_final_participation_changes'), /immutable/);
  } finally { await db.close(); }
});
