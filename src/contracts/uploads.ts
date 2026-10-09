import { z } from "zod";
import { ASSET_PURPOSES, AssetSchema, UtcTimestampSchema } from "./index.ts";

export const UploadRequestSchema = z.strictObject({
  revision: z.number().int().positive(), purpose: z.enum(ASSET_PURPOSES),
  filename: z.string().min(1).max(255).refine((v) => !/[\\/\u0000-\u001f]/.test(v)),
  sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  mediaType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
}).readonly();
export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export const UploadTargetSchema = z.object({ method: z.enum(["PUT", "POST"]), url: z.url().refine((value) => new URL(value).protocol === "https:"),
  headers: z.record(z.string(), z.string()).readonly(), expiresAt: UtcTimestampSchema,
}).readonly();
export type UploadTarget = z.infer<typeof UploadTargetSchema>;
export const UploadSessionSchema = z.object({ asset: AssetSchema, revision: z.number().int().positive(),
  upload: UploadTargetSchema.nullable(), expiresAt: UtcTimestampSchema,
}).readonly();
export type UploadSession = z.infer<typeof UploadSessionSchema>;
export const RemoveUploadSchema = z.strictObject({ revision: z.number().int().positive() }).readonly();
