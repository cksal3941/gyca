import { createHash } from "node:crypto";
import { PDFDocument, PDFName } from "pdf-lib";
import { EntryFault } from "../entries/errors.ts";

const MAX_PDF_BYTES = 64 * 1024 * 1024;
const FIXED_DATE = new Date("2000-01-01T00:00:00.000Z");

export async function createBlindPdfCandidate(source: Uint8Array) {
  try {
    if (source.byteLength < 1 || source.byteLength > MAX_PDF_BYTES) throw new EntryFault("FILE_TOO_LARGE", 413);
    const original = await PDFDocument.load(source, { ignoreEncryption: false, updateMetadata: false });
    const output = await PDFDocument.create();
    const pages = await output.copyPages(original, original.getPageIndices());
    if (pages.length < 1) throw new EntryFault("VALIDATION_FAILED", 422);
    for (const page of pages) {
      for (const key of ["Annots", "Metadata", "PieceInfo", "LastModified", "AA"]) page.node.delete(PDFName.of(key));
      output.addPage(page);
    }
    output.setTitle(""); output.setAuthor(""); output.setSubject(""); output.setKeywords([]);
    output.setCreator("GYCA blind-review pipeline"); output.setProducer("GYCA blind-review pipeline");
    output.setCreationDate(FIXED_DATE); output.setModificationDate(FIXED_DATE);
    const bytes = await output.save({ addDefaultPage: false, useObjectStreams: true, updateFieldAppearances: false });
    if (bytes.byteLength > MAX_PDF_BYTES) throw new EntryFault("FILE_TOO_LARGE", 413);
    return { bytes, pageCount: pages.length, checksum: createHash("sha256").update(bytes).digest("hex") };
  } catch (error) {
    if (error instanceof EntryFault) throw error;
    throw new EntryFault("VALIDATION_FAILED", 422);
  }
}
