import { z } from "zod";
import { CompetitionIdSchema } from "./index.ts";

export const POSTER_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const POSTER_MAX_BYTES = 5 * 1024 * 1024;

// Public, content-addressed URL of a competition's poster. The version segment is the first 16 hex
// characters of the stored SHA-256, so a re-upload changes the URL and caches can be immutable.
export function competitionPosterUrl(slug: string, sha256: string): string {
  return `/api/v1/content/competition-posters/${encodeURIComponent(slug)}/${sha256.slice(0, 16)}`;
}

export const CompetitionPosterInfoSchema = z.strictObject({
  contentType: z.enum(POSTER_CONTENT_TYPES), byteSize: z.number().int().positive().max(POSTER_MAX_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), uploadedAt: z.iso.datetime(), url: z.string().min(1),
}).readonly();
export const AdminCompetitionPosterSchema = z.strictObject({
  competitionId: CompetitionIdSchema, poster: CompetitionPosterInfoSchema.nullable(),
  allowedActions: z.array(z.enum(["upload", "remove"])).readonly(),
}).readonly();
export type AdminCompetitionPoster = z.infer<typeof AdminCompetitionPosterSchema>;
