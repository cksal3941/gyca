import { z } from "zod";
import { EntryIdSchema, UtcTimestampSchema } from "./index.ts";

export const WithdrawDraftRequestSchema = z.strictObject({ revision: z.number().int().positive() }).readonly();
export const DraftWithdrawalReadinessSchema = z.object({ entryId: EntryIdSchema, revision: z.number().int().positive(),
  allowedActions: z.array(z.literal("withdraw_draft")).readonly(),
  blockingReasons: z.array(z.literal("ENTRY_LOCKED")).readonly(),
}).readonly();
export const DraftWithdrawalSchema = z.object({ entryId: EntryIdSchema, revision: z.number().int().positive(),
  entryStatus: z.literal("withdrawn"), withdrawnAt: UtcTimestampSchema }).readonly();
