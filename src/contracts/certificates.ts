import { z } from "zod";
import { CertificateIdSchema, CertificateSummarySchema, EntryIdSchema, UtcTimestampSchema } from "./index.ts";

export const CertificateStageSchema = z.enum(["official_selection", "finalist"]);
export const IssueCertificatesRequestSchema = z.strictObject({
  entryIds: z.array(z.uuid()).min(1).max(100).refine(ids => new Set(ids).size === ids.length, "Duplicate entry id"),
  stage: CertificateStageSchema,
  actionId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/),
}).readonly();
export const CertificateIssueItemSchema = z.object({
  id: CertificateIdSchema, entryId: EntryIdSchema,
  state: z.enum(["pending", "issued", "stalled"]), issuedAt: UtcTimestampSchema.nullable(),
}).readonly();
export const CertificateIssueResultSchema = z.object({
  stage: CertificateStageSchema, requested: z.number().int().positive(),
  items: z.array(CertificateIssueItemSchema).readonly(),
}).readonly();
export const CertificateDownloadSchema = z.object({
  url: z.url().refine(value => new URL(value).protocol === "https:"), issuedAt: UtcTimestampSchema,
  expiresAt: UtcTimestampSchema,
}).readonly();

export { CertificateSummarySchema };
