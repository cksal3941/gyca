import { z } from "zod";
import { ENTRY_STATUSES, PAYMENT_STATES, PUBLISHED_RESULTS } from "./index.ts";

export const EntryExportRequestSchema = z.strictObject({
  q: z.string().trim().max(200).optional(), entryStatus: z.enum(ENTRY_STATUSES).nullable().optional(),
  paymentState: z.enum(PAYMENT_STATES).nullable().optional(),
  publishedResult: z.union([z.enum(PUBLISHED_RESULTS), z.literal("not_announced")]).nullable().optional(),
  sort: z.enum(["created_desc", "created_asc", "name_asc"]).optional(),
}).readonly();
export type EntryExportRequest = z.infer<typeof EntryExportRequestSchema>;
