import { z } from "zod";
import { ConsentDocumentSchema } from "./submissions.ts";

export const GuardianEvidenceSchema = z.strictObject({
  requestId: z.uuid(), entryRevision: z.number().int().positive(), locale: z.enum(["en", "ko"]),
  documents: z.array(ConsentDocumentSchema), createdAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  guardianName: z.string().nullable(), acceptedAt: z.iso.datetime().nullable(),
  verification: z.strictObject({ verifiedAt: z.iso.datetime(), evidenceReference: z.string().min(1).max(200) }).nullable(),
}).readonly();
export const GuardianEvidencePageSchema = z.strictObject({
  entryId: z.uuid(), items: z.array(GuardianEvidenceSchema), nextCursor: z.uuid().nullable(),
  verificationStatus: z.enum(["not_verified", "pending_review", "verified", "expired", "stale"]),
  allowedActions: z.array(z.literal("verify_guardian")).max(1),
}).readonly();
export const VerifyGuardianRequestSchema = z.strictObject({
  entryRevision: z.number().int().positive(),
  evidenceReference: z.string().trim().min(1).max(200),
}).readonly();
export const GuardianVerificationResultSchema = z.strictObject({
  requestId: z.uuid(), entryId: z.uuid(), entryRevision: z.number().int().positive(),
  verificationStatus: z.literal("verified"), evidenceReference: z.string().min(1).max(200),
  verifiedAt: z.iso.datetime(),
}).readonly();
