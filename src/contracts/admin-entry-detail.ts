import { z } from "zod";
import { AdminEntrySchema } from "./admin-entries.ts";
import { ASSET_PURPOSES, REJECTION_CODES, ParticipantDraftSchema, WorkDraftSchema } from "./index.ts";
import { CONSENT_KINDS } from "./submissions.ts";
import { CertificateStageSchema } from "./certificates.ts";

export const AdminEntryDetailSchema = AdminEntrySchema.unwrap().extend({
  participant: ParticipantDraftSchema,
  work: WorkDraftSchema,
  files: z.array(z.object({
    id: z.uuid(), purpose: z.enum(ASSET_PURPOSES), displayName: z.string().min(1), mediaType: z.string().min(1),
    sizeBytes: z.number().int().nonnegative().safe(), pageCount: z.number().int().positive().nullable(),
    state: z.enum(["pending_upload", "uploaded", "validating", "ready", "rejected"]),
    rejectionCode: z.enum(REJECTION_CODES).nullable(),
  }).readonly()).readonly(),
  guardianVerificationStatus: z.enum(["not_verified", "pending_review", "verified", "expired", "stale"]),
  consents: z.array(z.object({
    kind: z.enum(CONSENT_KINDS), version: z.string().min(1), locale: z.enum(["en", "ko"]), acceptedAt: z.iso.datetime(),
  }).readonly()).readonly(),
  certificates: z.array(z.object({
    id: z.uuid(), stage: CertificateStageSchema, state: z.enum(["pending", "issued", "stalled"]),
    issuedAt: z.iso.datetime().nullable(),
  }).readonly()).readonly(),
  audit: z.array(z.object({
    id: z.string().min(1), type: z.enum(["entry.created", "entry.submitted", "payment.succeeded", "entry.received",
      "review.updated", "result.published", "final_participation.updated", "certificate.queued", "certificate.issued",
      "certificate.retry_scheduled", "certificate.stalled"]),
    actorId: z.string().min(1).nullable(), occurredAt: z.iso.datetime(),
  }).readonly()).max(100).readonly(),
}).readonly();
export type AdminEntryDetail = z.infer<typeof AdminEntryDetailSchema>;
