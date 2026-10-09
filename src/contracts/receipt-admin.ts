import { z } from "zod";
import { EntryIdSchema, OrderIdSchema, ENTRY_STATUSES } from "./index.ts";

export const ReceiptDeliveryPageSchema = z.strictObject({
  items: z.array(z.strictObject({ entryId: EntryIdSchema, orderId: OrderIdSchema,
    entryStatus: z.enum(ENTRY_STATUSES), state: z.enum(["pending", "running", "provider_accepted", "stalled"]),
    attempts: z.number().int().nonnegative(), nextAttemptAt: z.iso.datetime().nullable(),
    providerAcceptedAt: z.iso.datetime().nullable(), emailVerified: z.boolean(),
    allowedActions: z.array(z.never()).max(0),
  }).readonly()).readonly(),
  nextCursor: z.string().nullable(),
}).readonly();
