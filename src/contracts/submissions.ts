import { z } from "zod";
import { BLOCKING_REASONS, FIELD_ERROR_CODES, EntryIdSchema, UtcTimestampSchema } from "./index.ts";

export const CONSENT_KINDS = ["participation_rules", "privacy", "work_license"] as const;
export const ConsentDocumentSchema = z.strictObject({
  kind: z.enum(CONSENT_KINDS), version: z.string().min(1).max(128),
  locale: z.enum(["en", "ko"]), title: z.string().trim().min(1).max(500),
  text: z.string().trim().min(1).max(100000),
}).readonly();
export const SubmitEntryRequestSchema = z.strictObject({
  revision: z.number().int().positive(), locale: z.enum(["en", "ko"]),
  policyToken: z.string().regex(/^[a-f0-9]{64}$/),
  consents: z.array(z.strictObject({ kind: z.enum(CONSENT_KINDS), version: z.string().min(1).max(128),
    accepted: z.literal(true) }).readonly()).length(3).readonly(),
}).refine((v) => new Set(v.consents.map((c) => c.kind)).size === 3).readonly();
export const SubmissionReadinessSchema = z.object({
  entryId: EntryIdSchema, revision: z.number().int().positive(), policyToken: z.string().nullable(),
  locale: z.enum(["en", "ko"]), documents: z.array(ConsentDocumentSchema).readonly(),
  allowedActions: z.array(z.literal("submit")).readonly(),
  blockingReasons: z.array(z.enum(BLOCKING_REASONS)).readonly(),
  fieldErrors: z.array(z.object({ path: z.string(), code: z.enum(FIELD_ERROR_CODES) }).readonly()).readonly(),
  ageGroup: z.string().nullable(),
}).readonly();
export const SubmissionResultSchema = z.object({
  entryId: EntryIdSchema, revision: z.number().int().positive(), entryStatus: z.literal("submitted"),
  submittedAt: UtcTimestampSchema, receiptNumber: z.null(), receivedAt: z.null(),
  allowedActions: z.array(z.literal("view_submission")).readonly(),
  blockingReasons: z.array(z.enum(["PAYMENT_REQUIRED", "PAYMENT_UNAVAILABLE"])).readonly(),
}).readonly();
export type SubmitEntryRequest = z.infer<typeof SubmitEntryRequestSchema>;
export type SubmissionReadiness = z.infer<typeof SubmissionReadinessSchema>;
export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;
