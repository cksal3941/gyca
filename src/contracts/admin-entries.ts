import { z } from "zod";
import { EntryIdSchema, OrderIdSchema, ENTRY_STATUSES, PAYMENT_STATES, PUBLISHED_RESULTS, REVIEW_STATUSES, MoneySchema } from "./index.ts";

export const AdminFileStateSchema = z.enum(["ready", "validating", "rejected", "pending"]);
export const AdminEntryActionSchema = z.enum(["view_guardian_consents", "issue_certificate"]);

export const AdminEntrySchema = z.strictObject({
  id: EntryIdSchema, participantName: z.string().nullable(), entryStatus: z.enum(ENTRY_STATUSES),
  workTitle: z.string().nullable(), category: z.string().nullable(), ageGroup: z.string().nullable(),
  reviewStatus: z.enum(REVIEW_STATUSES), publishedResult: z.enum(PUBLISHED_RESULTS).nullable(),
  fileState: AdminFileStateSchema, certificateIssued: z.boolean(),
  createdAt: z.iso.datetime(), submittedAt: z.iso.datetime().nullable(), receivedAt: z.iso.datetime().nullable(),
  receiptNumber: z.string().nullable(),
  payment: z.strictObject({ id: OrderIdSchema, state: z.enum(PAYMENT_STATES), money: MoneySchema,
    needsReview: z.boolean(), liveMode: z.boolean() }).nullable(),
  allowedActions: z.array(AdminEntryActionSchema).readonly(),
}).readonly();
export const AdminEntriesPageSchema = z.strictObject({
  items: z.array(AdminEntrySchema).readonly(), nextCursor: z.string().max(2048).nullable(), total: z.number().int().nonnegative(),
}).readonly();
