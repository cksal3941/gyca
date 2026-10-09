import { z } from "zod";

const retentionWindow = z.strictObject({ deleteAfterDays: z.number().int().min(0).max(3650) }).readonly();
const evidenceWindow = z.strictObject({ retainDays: z.number().int().min(1).max(3650) }).readonly();

export const RetentionPolicySchema = z.strictObject({
  enabled: z.literal(true),
  version: z.string().trim().min(1).max(100),
  withdrawnDraftAssets: retentionWindow,
  unselectedSubmissionAssets: retentionWindow,
  selectedSubmissionAssets: retentionWindow,
  consentEvidence: evidenceWindow,
  paymentEvidence: evidenceWindow,
}).readonly();

export const UpdateRetentionPolicySchema = z.strictObject({
  revision: z.number().int().positive(), policy: RetentionPolicySchema,
}).readonly();

export const RetentionPolicyDetailSchema = z.strictObject({
  competitionId: z.string().min(1).max(128), revision: z.number().int().positive(),
  policy: RetentionPolicySchema.nullable(),
}).readonly();

export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
