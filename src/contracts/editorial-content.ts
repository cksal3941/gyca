import { z } from "zod";
import { DateOnlySchema, LocalizedTextSchema, UtcTimestampSchema, pageSchema } from "./index.ts";

export const EDITORIAL_CATEGORIES = ["notice", "schedule", "faq", "news", "press"] as const;
export const EDITORIAL_STATUSES = ["draft", "published", "archived"] as const;
const assetReference = z.string().max(2000).refine(value => (value.startsWith("/") && !value.startsWith("//")) || (() => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
})(), "Image reference must be a site path or HTTPS URL");
export const EditorialBodySchema = z.strictObject({
  title: z.strictObject({ en: z.string().trim().min(1).max(500), ko: z.string().trim().min(1).max(500) }).readonly(),
  summary: z.strictObject({ en: z.string().trim().min(1).max(2000), ko: z.string().trim().min(1).max(2000) }).readonly(),
  body: z.strictObject({ en: z.string().trim().min(1).max(50000), ko: z.string().trim().min(1).max(50000) }).readonly(),
  displayDate: DateOnlySchema, coverImage: z.strictObject({ src: assetReference, alt: LocalizedTextSchema }).readonly().nullable(),
}).readonly();
const baseShape = { id: z.uuid(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128),
  category: z.enum(EDITORIAL_CATEGORIES), status: z.enum(EDITORIAL_STATUSES), revision: z.number().int().positive(),
  content: EditorialBodySchema, createdAt: UtcTimestampSchema, updatedAt: UtcTimestampSchema,
  publishedAt: UtcTimestampSchema.nullable() } as const;
export const EditorialAdminItemSchema = z.object({ ...baseShape,
  allowedActions: z.array(z.enum(["edit", "publish", "archive"])).readonly(),
}).superRefine((value, ctx) => {
  const expected = value.status === "draft" ? ["edit", "publish", "archive"] : value.status === "published" ? ["edit", "archive"] : [];
  if (JSON.stringify(value.allowedActions) !== JSON.stringify(expected)) ctx.addIssue({ code: "custom", message: "Actions do not match editorial state" });
}).readonly();
export const EditorialPublicItemSchema = z.object({ id: baseShape.id, slug: baseShape.slug, category: baseShape.category,
  content: EditorialBodySchema, publishedAt: UtcTimestampSchema }).readonly();
export const EditorialAdminPageSchema = pageSchema(EditorialAdminItemSchema);
export const EditorialPublicPageSchema = pageSchema(EditorialPublicItemSchema);
const actionId = z.uuid();
export const CreateEditorialSchema = z.strictObject({ actionId, slug: baseShape.slug, category: baseShape.category,
  content: EditorialBodySchema }).readonly();
export const UpdateEditorialSchema = z.strictObject({ actionId, expectedRevision: z.number().int().positive(),
  content: EditorialBodySchema }).readonly();
export const TransitionEditorialSchema = z.strictObject({ actionId, expectedRevision: z.number().int().positive() }).readonly();
export type EditorialBody = z.infer<typeof EditorialBodySchema>;
