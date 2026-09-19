import { z } from "zod";
import { LocalizedTextSchema, UtcTimestampSchema, pageSchema } from "./index.ts";

export const PARTNER_TYPES = ["organizer", "international_program_partner", "venue", "cultural_partner", "publishing_partner", "educational_partner"] as const;
export const PARTNER_STATUSES = ["draft", "published", "archived"] as const;
export const PARTNER_RELATIONSHIP_STATUSES = ["pending", "confirmed", "revoked"] as const;
const reference = z.string().max(2000).refine(value => (value.startsWith("/") && !value.startsWith("//")) || (() => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
})());
export const PartnerBodySchema = z.strictObject({ name: LocalizedTextSchema,
  description: z.strictObject({ en: z.string().trim().min(1).max(5000), ko: z.string().trim().min(1).max(5000) }).readonly(),
  displayOrder: z.number().int().min(0).max(10000),
  websiteUrl: z.url().refine(value => new URL(value).protocol === "https:").nullable(),
  logo: z.strictObject({ src: reference, alt: LocalizedTextSchema }).readonly().nullable(),
}).readonly();
const base = { id: z.uuid(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128), partnerType: z.enum(PARTNER_TYPES),
  status: z.enum(PARTNER_STATUSES), relationshipStatus: z.enum(PARTNER_RELATIONSHIP_STATUSES), revision: z.number().int().positive(),
  content: PartnerBodySchema, createdAt: UtcTimestampSchema, updatedAt: UtcTimestampSchema, publishedAt: UtcTimestampSchema.nullable() } as const;
const action = z.enum(["edit", "confirm_relationship", "publish", "archive", "revoke_relationship"]);
export const PartnerAdminItemSchema = z.object({ ...base, allowedActions: z.array(action).readonly() }).readonly();
export const PartnerPublicItemSchema = z.object({ id: base.id, slug: base.slug, partnerType: base.partnerType,
  content: PartnerBodySchema, publishedAt: UtcTimestampSchema }).readonly();
export const PartnerAdminPageSchema = pageSchema(PartnerAdminItemSchema);
export const PartnerPublicPageSchema = pageSchema(PartnerPublicItemSchema);
export const CreatePartnerSchema = z.strictObject({ actionId: z.uuid(), slug: base.slug, partnerType: base.partnerType,
  content: PartnerBodySchema }).readonly();
export const UpdatePartnerSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive(), content: PartnerBodySchema }).readonly();
export const PartnerTransitionSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive() }).readonly();
export const PartnerRelationshipSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive(),
  evidenceReference: z.string().trim().min(1).max(500), reason: z.string().trim().min(1).max(1000) }).readonly();
export type PartnerBody = z.infer<typeof PartnerBodySchema>;
