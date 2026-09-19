import { z } from "zod";
import { UtcTimestampSchema } from "./index.ts";

export const SubmissionDownloadSchema = z.object({
  url: z.url().refine(value => new URL(value).protocol === "https:"),
  expiresAt: UtcTimestampSchema,
}).readonly();
