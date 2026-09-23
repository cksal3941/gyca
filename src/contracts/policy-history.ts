import { z } from "zod";
import { SubmissionPolicySchema } from "./submission-policy.ts";
import { PaymentPolicySchema, PaymentRoutingPolicySchema } from "./payment-policy.ts";

const common = { revision: z.number().int().positive(), actorId: z.string(), createdAt: z.iso.datetime() };
export const PolicyHistoryPageSchema = z.strictObject({
  items: z.array(z.discriminatedUnion("kind", [
    z.strictObject({ ...common, kind: z.literal("submission"), policy: SubmissionPolicySchema }),
    z.strictObject({ ...common, kind: z.literal("payment"), policy: PaymentPolicySchema, routing: PaymentRoutingPolicySchema }),
  ])).readonly(), nextCursor: z.number().int().positive().nullable(),
}).readonly();
