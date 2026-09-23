import { z } from "zod";
import { CompetitionIdSchema, UtcTimestampSchema } from "./index.ts";

const count = z.number().int().nonnegative().safe();
export const PaymentHealthSchema = z.object({
  competitionId: CompetitionIdSchema, measuredAt: UtcTimestampSchema,
  orders: z.object({ total: count, pending: count, succeeded: count, failed: count,
    cancelled: count, expired: count, needsReview: count }).readonly(),
  recovery: z.object({ pending: count, running: count, completed: count, stalled: count,
    due: count, expiredLeases: count, oldestDueAt: UtcTimestampSchema.nullable() }).readonly(),
}).readonly();
export type PaymentHealth = z.infer<typeof PaymentHealthSchema>;
