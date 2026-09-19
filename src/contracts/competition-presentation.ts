import { z } from 'zod';
import { CompetitionIdSchema, CompetitionSchema, pageSchema } from './index.ts';
import { PublicCopySchema, PublicMediaSchema } from './public-media.ts';

export const CompetitionPresentationSchema = z.strictObject({
  summary: PublicCopySchema.nullable(), category: PublicCopySchema.nullable(),
  city: PublicCopySchema.nullable(), cover: PublicMediaSchema.nullable(),
}).readonly();
export const UpdateCompetitionPresentationSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(), content: CompetitionPresentationSchema,
  evidenceReference: z.string().trim().min(1).max(500),
}).readonly();
export const AdminCompetitionPresentationSchema = z.strictObject({
  competitionId: CompetitionIdSchema, revision: z.number().int().nonnegative(), content: CompetitionPresentationSchema,
  updatedAt: z.iso.datetime().nullable(), allowedActions: z.array(z.literal('edit')).readonly(),
}).readonly();
export const CompetitionCardSchema = z.strictObject({
  competition: CompetitionSchema, presentation: CompetitionPresentationSchema,
}).readonly();
export const CompetitionCardsPageSchema = pageSchema(CompetitionCardSchema);
