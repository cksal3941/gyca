import { z } from "zod";
import { UtcTimestampSchema } from "./index.ts";

export const LAUNCH_VERIFICATION_CODES = ["storage", "retention", "live_payment_verification"] as const;
export const RecordLaunchVerificationSchema = z.strictObject({
  actionId: z.uuid(), expectedRevision: z.number().int().positive(), code: z.enum(LAUNCH_VERIFICATION_CODES),
  evidenceReference: z.string().trim().min(1).max(500), validUntil: UtcTimestampSchema,
}).readonly();
export const LaunchVerificationSchema = z.strictObject({
  id: z.uuid(), competitionId: z.string(), competitionRevision: z.number().int().positive(),
  code: z.enum(LAUNCH_VERIFICATION_CODES), evidenceReference: z.string(), verifiedAt: UtcTimestampSchema,
  validUntil: UtcTimestampSchema,
}).readonly();
export const OpenApplicationsSchema = z.strictObject({
  actionId: z.uuid(), expectedRevision: z.number().int().positive(), reason: z.string().trim().min(1).max(1000),
}).readonly();
export const OpenedApplicationsSchema = z.strictObject({
  actionId: z.uuid(), competitionId: z.string(), revision: z.number().int().positive(),
  draftEnabled: z.literal(true), paymentEnabled: z.literal(true), openedAt: UtcTimestampSchema,
}).readonly();
export type RecordLaunchVerification = z.infer<typeof RecordLaunchVerificationSchema>;
export type OpenApplications = z.infer<typeof OpenApplicationsSchema>;
