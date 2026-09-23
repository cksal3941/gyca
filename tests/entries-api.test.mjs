import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import * as http from '../src/server/entries/http.ts';
import * as repository from '../src/server/entries/repository.ts';

test('entry HTTP handlers persist owner drafts and enforce boundaries using PostgreSQL', async (t) => {
  const db = new PGlite();
  await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'), (\'bob\');');
  await db.exec(await readFile(new URL('../migrations/001_entries.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/002_competitions.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/003_uploads.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/004_submissions.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../migrations/005_payments.sql', import.meta.url), 'utf8'));
  await db.exec(`INSERT INTO gyca_competitions(id,slug,published,draft_enabled,opens_at,closes_at) VALUES ('leipzig','leipzig-2027',true,true,'2026-01-01Z','2027-01-01Z'), ('other','other',true,true,'2026-01-01Z','2027-01-01Z');`);
  await db.query('UPDATE gyca_competitions SET public_content=$1::jsonb', [JSON.stringify({
    title: { en: 'Test', ko: '테스트' }, fee: { currency: 'EUR', amountMinor: 7000 }, timezone: 'Asia/Seoul', keyDates: [], exhibition: null, guidelines: null,
    formSpec: { version: 'test-only', ageReferenceDate: '2026-01-01', categories: [], ageGroups: [], fields: [], uploads: [] },
  })]);
  const clock = () => new Date('2026-09-15T00:00:00Z');
  const store = repository.createEntryRepository(db, clock);
  const handlers = http.createEntryHandlers({ repository: store, now: clock,
    origin: 'https://gyca.test', getUserId: async (req) => req.headers.get('x-test-user') });
  const req = (method, path, body, user = 'alice', extra = {}) => new Request(`https://gyca.test${path}`, {
    method, headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-test-user': user, ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let entryId;
  try {
    await t.test('creates one draft for repeated creation keys', async () => {
      const request = () => req('POST', '/api/v1/entries', { competitionId: 'leipzig' }, 'alice', { 'idempotency-key': 'create-one' });
      const responses = await Promise.all([handlers.create(request()), handlers.create(request())]);
      assert.equal(responses[0].status, 201);
      const bodies = await Promise.all(responses.map((r) => r.json()));
      entryId = bodies[0].data.id;
      assert.equal(bodies[1].data.id, entryId);
      assert.equal(bodies[0].data.entryStatus, 'draft');
      assert.equal((await db.query('SELECT * FROM gyca_entries')).rows.length, 1);
    });
    await t.test('rejects reusing a key with another competition', async () => {
      const response = await handlers.create(req('POST', '/api/v1/entries', { competitionId: 'other' }, 'alice', { 'idempotency-key': 'create-one' }));
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error.code, 'IDEMPOTENCY_CONFLICT');
    });
    await t.test('saves partial fields without losing previous fields', async () => {
      const first = await handlers.update(req('PATCH', '/', { revision: 1, work: { englishTitle: 'Book', englishDescription: 'Story' } }), entryId);
      assert.equal(first.status, 200);
      const response = await handlers.update(req('PATCH', '/', { revision: 2, work: { englishTitle: 'New title' } }), entryId);
      const body = await response.json();
      assert.equal(body.data.work.englishDescription, 'Story');
      assert.equal(body.data.work.englishTitle, 'New title');
      assert.equal(body.data.revision, 3);
    });
    await t.test('allows only one update against the same revision', async () => {
      const responses = await Promise.all(['A', 'B'].map((title) => handlers.update(req('PATCH', '/', { revision: 3, work: { title } }), entryId)));
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    });
    await t.test('hides another owners draft for reads and writes', async () => {
      const read = await handlers.get(req('GET', '/', undefined, 'bob'), entryId);
      const write = await handlers.update(req('PATCH', '/', { revision: 4, work: { title: 'stolen' } }, 'bob'), entryId);
      assert.equal(read.status, 404);
      assert.equal(write.status, 404);
      const list = await handlers.list(req('GET', '/api/v1/entries', undefined, 'bob'));
      assert.deepEqual((await list.json()).data.items, []);
    });
    await t.test('rejects anonymous and cross origin requests', async () => {
      const anonymous = await handlers.get(req('GET', '/', undefined, ''), entryId);
      const cross = await handlers.update(req('PATCH', '/', { revision: 4, work: {} }, 'alice', { origin: 'https://evil.test' }), entryId);
      assert.equal(anonymous.status, 401);
      assert.equal(cross.status, 403);
    });
    await t.test('rejects client status or owner escalation', async () => {
      const response = await handlers.update(req('PATCH', '/', { revision: 4, entryStatus: 'received', ownerId: 'bob', work: {} }), entryId);
      assert.equal(response.status, 422);
    });
    await t.test('returns private no-store responses without owner ids', async () => {
      const response = await handlers.get(req('GET', '/'), entryId);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const data = (await response.json()).data;
      assert.equal(data.ownerId, undefined);
      assert.equal(data.owner_id, undefined);
    });
    await t.test('paginates without duplicate items or another owners entries', async () => {
      await handlers.create(req('POST', '/', { competitionId: 'other' }, 'alice', { 'idempotency-key': 'page-two' }));
      const first = await handlers.list(req('GET', '/api/v1/entries?limit=1'));
      const firstData = (await first.json()).data;
      assert.equal(firstData.items.length, 1);
      assert.ok(firstData.nextCursor);
      const second = await handlers.list(req('GET', `/api/v1/entries?limit=1&cursor=${firstData.nextCursor}`));
      const secondData = (await second.json()).data;
      assert.equal(secondData.items.length, 1);
      assert.notEqual(firstData.items[0].id, secondData.items[0].id);
      assert.equal(secondData.nextCursor, null);
    });
    await t.test('keeps submitted display labels frozen when competition content changes', async () => {
      const created = await handlers.create(req('POST', '/', { competitionId: 'leipzig' }, 'alice', { 'idempotency-key': 'frozen-labels' }));
      const id = (await created.json()).data.id;
      await db.query(`UPDATE gyca_entries SET status='submitted', submitted_at='2026-09-15T00:00:00Z',
        work=$2::jsonb WHERE id=$1`, [id, JSON.stringify({ englishTitle: 'Frozen Work', category: 'picture_book' })]);
      await db.query(`INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result)
        VALUES($1,'frozen-labels','hash','2026-09-15T00:00:00Z',$2::jsonb,'{}'::jsonb)`, [id, JSON.stringify({
        work: { englishTitle: 'Frozen Work', category: 'picture_book' },
        competition: { public_content: {
          title: { en: 'Frozen Competition', ko: '동결 공모전' },
          formSpec: { categories: [{ id: 'picture_book', label: { en: 'Picture Book', ko: '그림책' } }] },
        } },
      })]);
      const changedContent = {
        title: { en: 'Changed Competition', ko: '변경 공모전' }, fee: { currency: 'EUR', amountMinor: 7000 }, timezone: 'Asia/Seoul', keyDates: [], exhibition: null, guidelines: null,
        formSpec: { version: 'test-only', ageReferenceDate: '2026-01-01', categories: [], ageGroups: [], fields: [], uploads: [] },
      };
      await db.query('UPDATE gyca_competitions SET public_content=$1::jsonb WHERE id=$2', [JSON.stringify(changedContent), 'leipzig']);
      const response = await handlers.get(req('GET', '/'), id);
      const data = (await response.json()).data;
      assert.deepEqual(data.competitionTitle, { en: 'Frozen Competition', ko: '동결 공모전' });
      assert.equal(data.workTitle, 'Frozen Work');
      assert.deepEqual(data.categoryLabel, { en: 'Picture Book', ko: '그림책' });
      changedContent.title = { en: 'Test', ko: '테스트' };
      await db.query('UPDATE gyca_competitions SET public_content=$1::jsonb WHERE id=$2', [JSON.stringify(changedContent), 'leipzig']);
    });
    await t.test('rejects malformed JSON and oversized input before saving', async () => {
      const headers = { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-test-user': 'alice' };
      const malformed = await handlers.update(new Request('https://gyca.test/', { method: 'PATCH', headers, body: '{' }), entryId);
      const oversized = await handlers.update(req('PATCH', '/', { revision: 4, work: { title: 'x'.repeat(131072) } }), entryId);
      assert.equal(malformed.status, 422);
      assert.equal(oversized.status, 413);
    });
    await t.test('rejects invalid cursor and oversized list limits', async () => {
      const cursor = await handlers.list(req('GET', '/api/v1/entries?cursor=invalid'));
      const limit = await handlers.list(req('GET', '/api/v1/entries?limit=1000'));
      assert.equal(cursor.status, 422);
      assert.equal(limit.status, 422);
    });
    await t.test('locks submitted entries against edits', async () => {
      await db.query('UPDATE gyca_entries SET status=\'submitted\' WHERE id=$1', [entryId]);
      const response = await handlers.update(req('PATCH', '/', { revision: 4, work: {} }), entryId);
      assert.equal((await response.json()).error.code, 'ENTRY_LOCKED');
    });
    await t.test('blocks creation at the exclusive deadline', async () => {
      await db.exec("UPDATE gyca_competitions SET closes_at='2026-09-15T00:00:00Z'");
      const response = await handlers.create(req('POST', '/', { competitionId: 'leipzig' }, 'alice', { 'idempotency-key': 'late' }));
      assert.equal((await response.json()).error.code, 'DEADLINE_PASSED');
    });
    await t.test('keeps unresolved competition policy closed', async () => {
      await db.exec("UPDATE gyca_competitions SET closes_at=NULL WHERE id='other'");
      const response = await handlers.create(req('POST', '/', { competitionId: 'other' }, 'alice', { 'idempotency-key': 'unconfigured' }));
      assert.equal((await response.json()).error.code, 'POLICY_NOT_CONFIGURED');
    });
  } finally { await db.close(); }
});
