import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';
import { createLaunchReadiness } from '../src/server/competitions/launch-readiness.ts';

test('launch diagnostics reject upload policies beyond the actual inspection runtime', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY); INSERT INTO "user" VALUES('editor')`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competition_editors VALUES('editor'); INSERT INTO gyca_competitions(id,slug) VALUES('test','test')");
    const uploads = [
      { purpose: 'cover_image', requiredOnSubmit: true, allowedMediaTypes: ['image/png'], maxFiles: 1, maxBytes: 1024, minPages: null },
      { purpose: 'book_pdf', requiredOnSubmit: true, allowedMediaTypes: ['application/pdf'], maxFiles: 1, maxBytes: 64 * 1024 * 1024, minPages: 20 },
    ];
    const content = { title: { en: 'Test', ko: '테스트' }, fee: { amountMinor: 7000, currency: 'EUR' }, timezone: 'Asia/Seoul',
      keyDates: [], exhibition: null, guidelines: null, formSpec: { version: 'test', ageReferenceDate: '2026-01-01',
        categories: [{ id: 'book', label: { en: 'Book', ko: '책' } }], ageGroups: [{ id: 'youth', label: { en: 'Youth', ko: '청소년' }, minAgeInclusive: 7, maxAgeInclusive: 18 }], fields: [], uploads } };
    const assess = createLaunchReadiness(db, { providers: [], now: () => new Date() });
    const formStatus = async rules => {
      await db.query('UPDATE gyca_competitions SET public_content=$1::jsonb', [JSON.stringify({ ...content, formSpec: { ...content.formSpec, uploads: rules } })]);
      return (await assess('editor', 'test')).checks.find(check => check.code === 'form').status;
    };
    assert.equal(await formStatus(uploads), 'configured');
    for (const patch of [{ maxBytes: 64 * 1024 * 1024 + 1 }, { allowedMediaTypes: ['video/mp4'] }, { allowedMediaTypes: ['image/png'] }])
      assert.equal(await formStatus([uploads[0], { ...uploads[1], ...patch }]), 'missing');
    assert.equal(await formStatus([{ ...uploads[0], allowedMediaTypes: ['application/pdf'] }, uploads[1]]), 'missing');
    assert.equal(await formStatus([{ ...uploads[0], minPages: 2 }, uploads[1]]), 'missing');
  } finally { await db.close(); }
});
