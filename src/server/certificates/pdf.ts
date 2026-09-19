import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { CertificateStageSchema } from "../../contracts/certificates.ts";
import { LocalizedTextSchema } from "../../contracts/index.ts";
import { EntryFault } from "../entries/errors.ts";

export const CertificateSnapshotSchema = z.object({
  recipientName: z.string().min(1).max(300), workTitle: z.string().min(1).max(1000),
  competitionTitle: LocalizedTextSchema, stage: CertificateStageSchema,
  certificateNumber: z.string().min(1).max(128), issueDate: z.iso.date(),
}).readonly();

export async function createCertificatePdf(raw: unknown) {
  try {
    const snapshot = CertificateSnapshotSchema.parse(raw);
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    for (const value of [snapshot.recipientName, snapshot.workTitle, snapshot.competitionTitle.en]) regular.encodeText(value);
    const page = document.addPage([841.89, 595.28]);
    const center = (text: string, size: number, font = regular) => (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2;
    page.drawRectangle({ x: 28, y: 28, width: page.getWidth() - 56, height: page.getHeight() - 56,
      borderColor: rgb(0.12, 0.16, 0.23), borderWidth: 2 });
    page.drawText("GYCA", { x: center("GYCA", 18, bold), y: 510, size: 18, font: bold, color: rgb(0.12, 0.16, 0.23) });
    page.drawText("CERTIFICATE", { x: center("CERTIFICATE", 38, bold), y: 445, size: 38, font: bold, color: rgb(0.12, 0.16, 0.23) });
    const stage = snapshot.stage === "finalist" ? "FINALIST" : "OFFICIAL SELECTION";
    page.drawText(stage, { x: center(stage, 19, bold), y: 402, size: 19, font: bold, color: rgb(0.55, 0.38, 0.12) });
    page.drawText("This certificate is awarded to", { x: center("This certificate is awarded to", 13), y: 345, size: 13, font: regular });
    page.drawText(snapshot.recipientName, { x: center(snapshot.recipientName, 26, bold), y: 302, size: 26, font: bold });
    const title = `for the work \"${snapshot.workTitle}\"`;
    page.drawText(title, { x: center(title, 13), y: 264, size: 13, font: regular });
    page.drawText(snapshot.competitionTitle.en, { x: center(snapshot.competitionTitle.en, 16, bold), y: 219, size: 16, font: bold });
    page.drawText(snapshot.issueDate, { x: 72, y: 84, size: 10, font: regular });
    page.drawText(snapshot.certificateNumber, { x: page.getWidth() - 72 - regular.widthOfTextAtSize(snapshot.certificateNumber, 10),
      y: 84, size: 10, font: regular });
    const fixed = new Date(`${snapshot.issueDate}T00:00:00.000Z`);
    document.setTitle(`${stage} Certificate`); document.setAuthor("GYCA"); document.setSubject(snapshot.competitionTitle.en);
    document.setCreator("GYCA certificate service"); document.setProducer("GYCA certificate service");
    document.setCreationDate(fixed); document.setModificationDate(fixed);
    const bytes = await document.save({ useObjectStreams: true, updateFieldAppearances: false });
    return { bytes, checksum: createHash("sha256").update(bytes).digest("hex") };
  } catch (error) {
    if (error instanceof EntryFault) throw error;
    throw new EntryFault("VALIDATION_FAILED", 422);
  }
}
