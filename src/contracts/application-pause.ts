import { z } from "zod";

export const PauseApplicationsSchema = z.strictObject({ revision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000) }).readonly();
export const PausedApplicationsSchema = z.strictObject({ competitionId: z.string(), revision: z.number().int().positive(),
  draftEnabled: z.literal(false), paymentEnabled: z.boolean() }).readonly();
export const ResumeApplicationsSchema = z.strictObject({ revision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(1000) }).readonly();
export const ResumedApplicationsSchema = z.strictObject({ competitionId: z.string(), revision: z.number().int().positive(),
  draftEnabled: z.literal(true), paymentEnabled: z.boolean() }).readonly();
