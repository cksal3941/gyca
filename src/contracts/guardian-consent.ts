import { z } from "zod";
import { CONSENT_KINDS } from "./submissions.ts";

export const GuardianRequestSchema = z.strictObject({ revision: z.number().int().positive(), locale: z.enum(["en", "ko"]) }).readonly();
export const GuardianTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const GuardianPreviewSchema = z.strictObject({ token: GuardianTokenSchema }).readonly();
export const GuardianAcceptSchema = z.strictObject({ token: GuardianTokenSchema,
  guardianName: z.string().trim().min(1).max(200),
  acceptedKinds: z.array(z.enum(CONSENT_KINDS)).length(3).refine(kinds => new Set(kinds).size === 3),
}).readonly();
