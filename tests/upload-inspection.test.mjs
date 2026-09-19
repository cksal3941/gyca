import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import * as inspector from '../src/server/uploads/inspect.ts';

test('validates real PDF pages and bytes in an isolated worker', async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 20; i++) pdf.addPage();
  const bytes = await pdf.save();
  const result = await inspector.inspectUpload(bytes, { mediaType: 'application/pdf', maxBytes: 100000, minPages: 20 });
  assert.equal(result.state, 'ready');
  assert.equal(result.pageCount, 20);
  assert.equal(result.sizeBytes, bytes.length);
  assert.match(result.checksum, /^[a-f0-9]{64}$/);
});
test('rejects actual PDFs with fewer than required pages', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const result = await inspector.inspectUpload(await pdf.save(), { mediaType: 'application/pdf', maxBytes: 100000, minPages: 20 });
  assert.equal(result.rejectionCode, 'PDF_TOO_FEW_PAGES');
});
test('rejects a renamed non-PDF and a corrupted PDF', async () => {
  const options = { mediaType: 'application/pdf', maxBytes: 100000, minPages: 20 };
  const wrong = await inspector.inspectUpload(Buffer.from('<html>no</html>'), options);
  const broken = await inspector.inspectUpload(Buffer.from('%PDF-1.7\ninvalid'), options);
  assert.equal(wrong.rejectionCode, 'CONTENT_TYPE_MISMATCH');
  assert.equal(broken.rejectionCode, 'FILE_CORRUPTED');
});
test('rejects oversized bytes before parsing', async () => {
  const result = await inspector.inspectUpload(Buffer.alloc(100), { mediaType: 'image/png', maxBytes: 50, minPages: null });
  assert.equal(result.rejectionCode, 'FILE_TOO_LARGE');
});
test('decodes a real cover image', async () => {
  const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).png().toBuffer();
  const result = await inspector.inspectUpload(bytes, { mediaType: 'image/png', maxBytes: 100000, minPages: null });
  assert.equal(result.state, 'ready');
  assert.equal(result.pageCount, null);
});
