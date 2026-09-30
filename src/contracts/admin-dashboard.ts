import { z } from "zod";
import { CompetitionIdSchema, LocalizedTextSchema, UtcTimestampSchema } from "./index.ts";

const count = z.number().int().nonnegative().safe();
const entryCounts = z.object({ total: count, draft: count, submitted: count, received: count,
  withdrawn: count, expired: count, uniqueApplicants: count }).readonly();
const paymentCounts = z.object({ total: count, pending: count, succeeded: count, failed: count,
  cancelled: count, expired: count, needsReview: count, succeededAmountMinor: count, currency: z.literal("EUR") }).readonly();
const reviewCounts = z.object({ notStarted: count, underReview: count, completed: count,
  activeAssignments: count, submittedAssignments: count }).readonly();
const resultCounts = z.object({ notAnnounced: count, officialSelection: count, finalist: count, notSelected: count }).readonly();

export const AdminDashboardCompetitionSchema = z.object({
  id: CompetitionIdSchema, slug: z.string().min(1).max(128), title: LocalizedTextSchema.nullable(),
  published: z.boolean(), phase: z.enum(["scheduled", "judging", "result", "archived"]),
  entries: entryCounts, payments: paymentCounts, reviews: reviewCounts, results: resultCounts,
}).readonly();

export const AdminDashboardSchema = z.object({
  measuredAt: UtcTimestampSchema,
  accounts: z.object({ total: count }).readonly(),
  applicants: z.object({ uniqueAccounts: count, unknownResidenceCountry: count,
    byResidenceCountry: z.array(z.object({ country: z.string().min(1).max(200), count }).readonly()).max(250).readonly(),
  }).readonly(),
  competitions: z.object({ items: z.array(AdminDashboardCompetitionSchema).max(50).readonly(),
    nextCursor: CompetitionIdSchema.nullable(), total: count }).readonly(),
}).readonly();
export type AdminDashboard = z.infer<typeof AdminDashboardSchema>;
