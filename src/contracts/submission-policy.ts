import { z } from "zod";
import { ConsentDocumentSchema } from "./submissions.ts";

export const SubmissionPolicySchema = z.strictObject({
  enabled: z.literal(true), version: z.string().trim().min(1),
  guardianAgeBasis: z.literal("submission_date_in_competition_timezone"),
  guardianAgeByCountry: z.record(z.string().regex(/^[A-Z]{2}$/), z.number().int().min(0).max(19)),
  documents: z.array(ConsentDocumentSchema).min(3).max(6),
}).refine(p => new Set(p.documents.map(d => `${d.kind}:${d.locale}`)).size === p.documents.length);
export const UpdateSubmissionPolicySchema = z.strictObject({ revision: z.number().int().positive(), policy: SubmissionPolicySchema }).readonly();
export const SubmissionPolicyDetailSchema = z.strictObject({ competitionId: z.string(), revision: z.number().int().positive(),
  policy: SubmissionPolicySchema.nullable() }).readonly();
