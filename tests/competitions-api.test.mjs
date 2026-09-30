import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createCompetitionHandlers } from '../src/server/competitions/http.ts';
import { createEntryRepository } from '../src/server/entries/repository.ts';

test('public competition HTTP handlers use the same PostgreSQL policy as draft creation', async (t) => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'test-owner\');');
    for (const file of ['001_entries', '002_competitions', '003_uploads', '004_submissions', '005_payments'])
      await db.exec(await readFile(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
    const content = { title: { en: 'Test', ko: '테스트' }, fee: null, timezone: 'Asia/Seoul', keyDates: [],
      exhibition: null, guidelines: null, formSpec: { version: 'test-only', ageReferenceDate: '2026-01-01', categories: [], ageGroups: [], fields: [], uploads: [] } };
    for (const [id, phase, opens, closes, published] of [
      ['open', 'scheduled', '2026-01-01Z', '2027-01-01Z', true],
      ['upcoming', 'scheduled', '2026-12-01Z', '2027-01-01Z', true],
      ['closed', 'scheduled', '2026-01-01Z', '2026-09-15Z', true],
      ['judging', 'judging', '2026-01-01Z', '2027-01-01Z', true],
      ['result', 'result', '2026-01-01Z', '2027-01-01Z', true],
      ['archived', 'archived', '2026-01-01Z', '2027-01-01Z', true],
      ['hidden', 'scheduled', '2026-01-01Z', '2027-01-01Z', false],
    ]) await db.query(`INSERT INTO gyca_competitions(id,slug,phase,opens_at,closes_at,published,draft_enabled,public_content)
      VALUES($1,$1,$2,$3,$4,$5,true,$6::jsonb)`, [id, phase, opens, closes, published, JSON.stringify(content)]);
    const now = () => new Date('2026-09-15Z');
    const handlers = createCompetitionHandlers(db, now);
    const req = (query = '') => new Request(`https://gyca.test/api/v1/competitions${query}`);
    await t.test('filtered lists and individual projections agree for every status', async () => {
      for (const status of ['open', 'upcoming', 'closed', 'judging', 'result', 'archived']) {
        const response = await handlers.list(req(`?status=${status}`));
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.data.items.length, 1);
        assert.equal(body.data.items[0].status, status);
        assert.equal(body.data.items[0].published, undefined);
      }
    });
    await t.test('hidden competitions do not appear and detail returns 404', async () => {
      const list = await handlers.list(req());
      assert.equal((await list.json()).data.items.length, 6);
      const detail = await handlers.get(req(), 'hidden');
      assert.equal(detail.status, 404);
    });
    await t.test('pagination returns all public competitions without duplicates', async () => {
      const ids = [];
      let cursor = null;
      do {
        const response = await handlers.list(req(`?limit=2${cursor ? `&cursor=${cursor}` : ''}`));
        const data = (await response.json()).data;
        ids.push(...data.items.map((item) => item.id)); cursor = data.nextCursor;
      } while (cursor);
      assert.equal(ids.length, 6);
      assert.equal(new Set(ids).size, 6);
    });
    await t.test('public action and draft creation close together at deadline', async () => {
      const atDeadline = () => new Date('2027-01-01Z');
      const closed = createCompetitionHandlers(db, atDeadline);
      const response = await closed.get(req(), 'open');
      assert.deepEqual((await response.json()).data.allowedActions, []);
      const repository = createEntryRepository(db, atDeadline);
      await assert.rejects(repository.create('test-owner', 'open', 'late'), { code: 'DEADLINE_PASSED' });
    });
    await t.test('invalid filters and limits are rejected', async () => {
      assert.equal((await handlers.list(req('?status=unknown'))).status, 422);
      assert.equal((await handlers.list(req('?limit=500'))).status, 422);
    });
  } finally { await db.close(); }
});
