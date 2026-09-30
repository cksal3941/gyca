import { z } from "zod";
import { EntryIdSchema, UtcTimestampSchema } from "./index.ts";
import { ConsentDocumentSchema } from "./submissions.ts";

export const ConsentEvidenceSchema = z.object({
  entryId: EntryIdSchema,
  submittedAt: UtcTimestampSchema,
  consents: z.array(ConsentDocumentSchema.unwrap().extend({
    textSha256: z.string().regex(/^[a-f0-9]{64}$/),
    actorId: z.string().min(1), acceptedAt: UtcTimestampSchema,
  }).readonly()).length(3).refine(items => new Set(items.map(item => item.kind)).size === 3).readonly(),
}).readonly();
export type ConsentEvidence = z.infer<typeof ConsentEvidenceSchema>;
