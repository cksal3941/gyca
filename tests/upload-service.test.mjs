import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import * as uploads from '../src/server/uploads/service.ts';
import { inspectUpload } from '../src/server/uploads/inspect.ts';
import { createUploadHandlers } from '../src/server/uploads/http.ts';

test('upload lifecycle preserves ownership, immutable validation and slot limits', async (t) => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "user" (id text PRIMARY KEY); INSERT INTO "user" VALUES (\'alice\'),(\'bob\');');
    for (const file of ['001_entries', '002_competitions', '003_uploads'])
      await db.exec(await readFile(new URL(`../migrations/${file}.sql`, import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO gyca_competitions(id,slug,published,draft_enabled,opens_at,closes_at) VALUES('test','test',true,true,'2026-01-01Z','2027-01-01Z');
      INSERT INTO gyca_entries(id,owner_id,competition_id) VALUES ('00000000-0000-4000-8000-000000000001','alice','test');`);
    await db.query('UPDATE gyca_competitions SET public_content=$1::jsonb', [JSON.stringify({
      title: { en: 'Test', ko: '테스트' }, fee: null, timezone: 'Asia/Seoul', keyDates: [], exhibition: null, guidelines: null,
      formSpec: { version: 'test', ageReferenceDate: '2026-01-01', fields: [], categories: [], ageGroups: [], uploads: [
        { purpose: 'book_pdf', requiredOnSubmit: true, allowedMediaTypes: ['application/pdf'], maxFiles: 1, maxBytes: 100000, minPages: 20 },
      ] },
    })]);
    const objects = new Map();
    const storage = {
      async signCreate({ key, expiresAt }) { return { method: 'PUT', url: `https://storage.test/${key}`, headers: {}, expiresAt: expiresAt.toISOString() }; },
      async readImmutable(key) { return objects.get(key) ?? null; },
    };
    const service = uploads.createUploadService(db, storage, inspectUpload, () => new Date('2026-09-15Z'));
    const entryId = '00000000-0000-4000-8000-000000000001';
    const pdf = await PDFDocument.create(); for (let i = 0; i < 20; i++) pdf.addPage();
    const bytes = await pdf.save();
    const input = { revision: 1, purpose: 'book_pdf', filename: 'book.pdf', sizeBytes: bytes.length, mediaType: 'application/pdf' };
    let session;
    await t.test('reserves a slot and repeats the same idempotent session', async () => {
      session = await service.create('alice', entryId, 'key-one', input);
      const repeat = await service.create('alice', entryId, 'key-one', input);
      assert.equal(session.asset.id, repeat.asset.id);
      assert.equal(session.revision, 2);
      assert.equal(session.asset.state, 'pending_upload');
      assert.equal((await db.query('SELECT * FROM gyca_assets')).rows.length, 1);
    });
    await t.test('rejects slot over-allocation and altered idempotent payloads', async () => {
      await assert.rejects(service.create('alice', entryId, 'key-two', { ...input, revision: 2 }), { code: 'UPLOAD_LIMIT_REACHED' });
      await assert.rejects(service.create('alice', entryId, 'key-one', { ...input, filename: 'different.pdf' }), { code: 'IDEMPOTENCY_CONFLICT' });
    });
    await t.test('does not mark a missing object ready', async () => {
      await assert.rejects(service.complete('alice', entryId, session.asset.id), { code: 'FILE_NOT_READY' });
      assert.equal((await service.list('alice', entryId))[0].state, 'pending_upload');
    });
    await t.test('validates stored bytes and retains immutable version identity', async () => {
      const key = new URL(session.upload.url).pathname.slice(1);
      objects.set(key, { bytes, version: 'immutable-version-1' });
      const result = await service.complete('alice', entryId, session.asset.id);
      assert.equal(result.state, 'ready');
      assert.equal(result.pageCount, 20);
      const row = (await db.query('SELECT object_version,checksum FROM gyca_assets')).rows[0];
      assert.equal(row.object_version, 'immutable-version-1');
      assert.match(row.checksum, /^[a-f0-9]{64}$/);
      assert.deepEqual(await service.complete('alice', entryId, session.asset.id), result);
    });
    await t.test('does not expose another owners assets', async () => {
      await assert.rejects(service.list('bob', entryId), { code: 'NOT_FOUND' });
      await assert.rejects(service.complete('bob', entryId, session.asset.id), { code: 'NOT_FOUND' });
      await assert.rejects(service.remove('bob', entryId, session.asset.id, 2), { code: 'NOT_FOUND' });
    });
    await t.test('soft removal frees a slot but requires the current revision', async () => {
      await assert.rejects(service.remove('alice', entryId, session.asset.id, 1), { code: 'REVISION_CONFLICT' });
      assert.equal((await service.remove('alice', entryId, session.asset.id, 2)).revision, 3);
      assert.deepEqual(await service.list('alice', entryId), []);
      assert.equal((await db.query('SELECT * FROM gyca_assets')).rows.length, 1);
    });
    await t.test('unconfigured storage never issues a target', async () => {
      const disabled = uploads.createUploadService(db, null, inspectUpload, () => new Date('2026-09-15Z'));
      await assert.rejects(disabled.create('alice', entryId, 'disabled', { ...input, revision: 3 }), { code: 'STORAGE_UNAVAILABLE' });
    });
    await t.test('validates through authenticated HTTP and rejects client validation claims', async () => {
      const handlers = createUploadHandlers({ service, origin: 'https://gyca.test', now: () => new Date('2026-09-15Z'),
        getUserId: async (req) => req.headers.get('x-test-user') });
      const headers = { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-test-user': 'alice' };
      const response = await handlers.list(new Request('https://gyca.test/', { headers }), entryId);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal((await handlers.list(new Request('https://gyca.test/'), entryId)).status, 401);
      const forged = await handlers.complete(new Request('https://gyca.test/', { method: 'POST', headers,
        body: JSON.stringify({ pageCount: 20, state: 'ready' }) }), entryId, session.asset.id);
      assert.equal(forged.status, 422);
    });
    await t.test('inspection failure remains retryable without marking the file corrupted', async () => {
      const next = await service.create('alice', entryId, 'retry', { ...input, revision: 3 });
      const key = new URL(next.upload.url).pathname.slice(1);
      objects.set(key, { bytes, version: 'immutable-version-2' });
      const failed = uploads.createUploadService(db, storage, async () => { throw new Error('simulated infrastructure failure'); }, () => new Date('2026-09-15Z'));
      await assert.rejects(failed.complete('alice', entryId, next.asset.id), /simulated infrastructure/);
      assert.equal((await service.list('alice', entryId))[0].state, 'pending_upload');
      const result = await service.complete('alice', entryId, next.asset.id);
      assert.equal(result.state, 'ready');
      await service.remove('alice', entryId, next.asset.id, 4);
    });
    await t.test('removal during inspection cannot resurrect an asset', async () => {
      const next = await service.create('alice', entryId, 'race', { ...input, revision: 5 });
      objects.set(new URL(next.upload.url).pathname.slice(1), { bytes, version: 'immutable-version-3' });
      const started = Promise.withResolvers(); const resume = Promise.withResolvers();
      const delayed = uploads.createUploadService(db, storage, async (...args) => {
        started.resolve(); await resume.promise; return inspectUpload(...args);
      }, () => new Date('2026-09-15Z'));
      const completing = delayed.complete('alice', entryId, next.asset.id);
      const rejected = assert.rejects(completing, { code: 'NOT_FOUND' });
      await started.promise;
      await service.remove('alice', entryId, next.asset.id, 6);
      resume.resolve(); await rejected;
      assert.deepEqual(await service.list('alice', entryId), []);
    });
    await t.test('expires upload targets without marking a late file ready', async () => {
      const next = await service.create('alice', entryId, 'expiry', { ...input, revision: 7 });
      const later = uploads.createUploadService(db, storage, inspectUpload, () => new Date('2026-09-15T00:16:00Z'));
      await assert.rejects(later.complete('alice', entryId, next.asset.id), { code: 'UPLOAD_EXPIRED' });
      assert.equal((await later.list('alice', entryId))[0].state, 'pending_upload');
    });
  } finally { await db.close(); }
});
