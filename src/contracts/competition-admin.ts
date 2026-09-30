import { z } from "zod";
import { CompetitionSchema, UtcTimestampSchema } from "./index.ts";

const shape = CompetitionSchema.unwrap().shape;
export const CompetitionContentSchema = z.strictObject({
  title: z.strictObject({ en: z.string().trim().min(1).max(500), ko: z.string().trim().min(1).max(500) }).readonly(),
  fee: shape.fee, timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }), keyDates: shape.keyDates, formSpec: shape.formSpec, exhibition: shape.exhibition, guidelines: shape.guidelines,
}).readonly();
export const CompetitionEditSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128),
  content: CompetitionContentSchema, opensAt: UtcTimestampSchema.nullable(),
  closesAt: UtcTimestampSchema.nullable(), paymentClosesAt: UtcTimestampSchema.nullable(),
  published: z.boolean(),
}).refine(v => v.opensAt === null || v.closesAt === null || Date.parse(v.opensAt) < Date.parse(v.closesAt))
  .refine(v => v.paymentClosesAt === null || v.closesAt === null || Date.parse(v.paymentClosesAt) >= Date.parse(v.closesAt)).readonly();
export const CreateCompetitionSchema = z.strictObject({ id: z.uuid(), input: CompetitionEditSchema }).readonly();
export const UpdateCompetitionSchema = z.strictObject({ revision: z.number().int().positive(), input: CompetitionEditSchema }).readonly();
export type CompetitionEdit = z.infer<typeof CompetitionEditSchema>;
export type UpdateCompetition = z.infer<typeof UpdateCompetitionSchema>;
