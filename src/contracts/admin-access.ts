import { z } from "zod";
import { CompetitionIdSchema } from "./index.ts";

export const AdminAccessSchema = z.object({
  organizer: z.boolean(),
  paymentPermissions: z.array(z.object({
    competitionId: CompetitionIdSchema,
    permission: z.enum(["viewer", "operator"]),
  }).readonly()).readonly(),
  nextCursor: z.string().min(1).max(128).nullable(),
}).readonly();
export type AdminAccess = z.infer<typeof AdminAccessSchema>;
