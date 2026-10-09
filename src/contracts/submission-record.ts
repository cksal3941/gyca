import { z } from "zod";
import { ASSET_PURPOSES, AssetIdSchema, CompetitionIdSchema, ParticipantDraftSchema, WorkDraftSchema } from "./index.ts";
import { ConsentEvidenceSchema } from "./consent-evidence.ts";

export const SubmissionRecordSchema = ConsentEvidenceSchema.unwrap().extend({
  competitionId: CompetitionIdSchema,
  participant: ParticipantDraftSchema,
  work: WorkDraftSchema,
  ageGroup: z.string().nullable(),
  assets: z.array(z.object({
    id: AssetIdSchema, purpose: z.enum(ASSET_PURPOSES), displayName: z.string(),
    mediaType: z.string(), sizeBytes: z.number().int().positive().safe(),
    pageCount: z.number().int().positive().nullable(),
  }).readonly()).readonly(),
}).readonly();
export type SubmissionRecord = z.infer<typeof SubmissionRecordSchema>;
