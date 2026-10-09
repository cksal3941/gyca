import { z } from "zod";
import { PUBLISHED_RESULTS, REVIEW_STATUSES } from "./index.ts";

export const UpdateReviewDecisionSchema = z.strictObject({
  expectedRevision: z.number().int().nonnegative(),
  reviewStatus: z.enum(REVIEW_STATUSES),
  decision: z.enum(PUBLISHED_RESULTS).nullable(),
}).refine(value => (value.reviewStatus === "completed") === (value.decision !== null),
  { path: ["decision"], message: "Completed review requires a decision" }).readonly();

export const ReviewDecisionDetailSchema = z.strictObject({
  entryId: z.uuid(), revision: z.number().int().nonnegative(), reviewStatus: z.enum(REVIEW_STATUSES),
  decision: z.enum(PUBLISHED_RESULTS).nullable(), updatedAt: z.iso.datetime().nullable(),
}).readonly();

export const PublishResultsRequestSchema = z.strictObject({ competitionRevision: z.number().int().positive() }).readonly();
export const ResultPublicationSchema = z.strictObject({
  competitionId: z.string().min(1).max(128), sourceRevision: z.number().int().positive(),
  resultingRevision: z.number().int().positive(), entryCount: z.number().int().positive(),
  publishedAt: z.iso.datetime(),
}).readonly();

export const ResultRoundSchema = z.enum(["official_selection", "finalist"]);
export const PublishResultRoundRequestSchema = z.strictObject({ competitionRevision: z.number().int().positive() }).readonly();
export const ResultRoundPublicationSchema = z.strictObject({ competitionId: z.string().min(1).max(128), round: ResultRoundSchema,
  sourceRevision: z.number().int().positive(), resultingRevision: z.number().int().positive(),
  eligibleCount: z.number().int().positive(), selectedCount: z.number().int().nonnegative(), publishedAt: z.iso.datetime() }).readonly();
export const RespondFinalParticipationSchema = z.strictObject({ expectedRevision: z.number().int().positive(),
  response: z.enum(["accept", "decline"]), actionId: z.string().regex(/^[\x21-\x7e]{1,128}$/) }).readonly();
export const AdminFinalParticipationSchema = z.strictObject({ expectedRevision: z.number().int().positive(),
  state: z.enum(["confirmed", "declined"]), reason: z.string().trim().min(1).max(1000),
  actionId: z.string().regex(/^[\x21-\x7e]{1,128}$/) }).readonly();
export const FinalParticipationMutationSchema = z.strictObject({ entryId: z.uuid(), revision: z.number().int().positive(),
  state: z.enum(["invited", "confirmation_pending", "confirmed", "declined"]), invitationPublishedAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(), orderId: z.uuid().nullable(), updatedAt: z.iso.datetime() }).readonly();
