import { parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { PDFDocument, EncryptedPDFError } from 'pdf-lib';
import sharp from 'sharp';

const bytes = Buffer.from(workerData.bytes);
const { mediaType, maxBytes, minPages } = workerData.options;
const base = { sizeBytes: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex'), pageCount: null };
const reject = (rejectionCode) => ({ ...base, state: 'rejected', rejectionCode });

async function inspect() {
  if (bytes.length > maxBytes) return reject('FILE_TOO_LARGE');
  if (bytes.length === 0) return reject('FILE_CORRUPTED');
  switch (mediaType) {
    case 'application/pdf': {
      if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) return reject('CONTENT_TYPE_MISMATCH');
      if (!bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) return reject('FILE_CORRUPTED');
      try {
        const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
        const pageCount = pdf.getPageCount();
        if (pageCount < (minPages ?? 1)) return { ...reject('PDF_TOO_FEW_PAGES'), pageCount };
        return { ...base, state: 'ready', rejectionCode: null, pageCount };
      } catch (error) {
        if (error instanceof EncryptedPDFError) return reject('PDF_ENCRYPTED');
        if (error instanceof Error) return reject('FILE_CORRUPTED');
        throw error;
      }
    }
    case 'image/png': case 'image/jpeg': {
      try {
        const decoder = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
        const metadata = await decoder.metadata();
        const expected = mediaType === 'image/png' ? 'png' : 'jpeg';
        if (metadata.format !== expected) return reject('CONTENT_TYPE_MISMATCH');
        await decoder.stats();
        return { ...base, state: 'ready', rejectionCode: null };
      } catch (error) {
        if (error instanceof Error) return reject('FILE_CORRUPTED');
        throw error;
      }
    }
    default: return reject('UNSUPPORTED_MEDIA_TYPE');
  }
}

parentPort.postMessage(await inspect());
