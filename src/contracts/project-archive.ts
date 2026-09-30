import { z } from "zod";
import { pageSchema } from "./index.ts";
import { PublicCopySchema, PublicMediaSchema } from "./public-media.ts";

export const ARCHIVE_SECTION_KINDS = ['intro', 'process', 'selection', 'exhibition_photos', 'ceremony_photos',
  'sales', 'buyer_interviews', 'exhibition_certificate', 'sales_certificate', 'results'] as const;
export const ARCHIVE_STATUSES = ['draft', 'published', 'archived'] as const;
const sectionBase = {
  kind: z.enum(ARCHIVE_SECTION_KINDS), order: z.number().int().min(1).max(10), title: PublicCopySchema,
  optional: z.boolean(), pendingNote: PublicCopySchema.nullable(),
};
const sectionPayload = {
  intro: PublicCopySchema.nullable(), gallery: z.array(PublicMediaSchema).max(30).readonly(),
  documents: z.array(PublicMediaSchema).max(10).readonly(),
  quotes: z.array(z.strictObject({ quote: PublicCopySchema, attribution: PublicCopySchema }).readonly()).max(20).readonly(),
  stats: z.array(z.strictObject({ label: PublicCopySchema, value: PublicCopySchema }).readonly()).max(20).readonly(),
};
export const ArchiveSectionSchema = z.strictObject({ ...sectionBase, ...sectionPayload,
  status: z.enum(['pending', 'ready']),
}).superRefine((value, ctx) => {
  if (value.status === 'ready' && value.intro === null && !value.gallery.length && !value.documents.length
    && !value.quotes.length && !value.stats.length) ctx.addIssue({ code: 'custom', message: 'Ready section requires content' });
}).readonly();
export const ArchivePublicSectionSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...sectionBase, status: z.literal('pending') }).readonly(),
  z.strictObject({ ...sectionBase, ...sectionPayload, status: z.literal('ready') }).readonly(),
]);
const hero = z.strictObject({ program: PublicCopySchema, summary: PublicCopySchema,
  location: PublicCopySchema.nullable(), period: PublicCopySchema.nullable(),
  operated: z.array(PublicCopySchema).max(20).readonly(), image: PublicMediaSchema.nullable(),
}).readonly();
const shared = { projectType: z.enum(['art', 'book', 'composition', 'performance', 'interdisciplinary']),
  completionYear: z.number().int().min(1900).max(2100).nullable(), hero };
export const ArchiveContentSchema = z.strictObject({ ...shared,
  sections: z.array(ArchiveSectionSchema).min(1).max(10).readonly(),
}).superRefine((value, ctx) => {
  if (new Set(value.sections.map(s => s.kind)).size !== value.sections.length
    || new Set(value.sections.map(s => s.order)).size !== value.sections.length)
    ctx.addIssue({ code: 'custom', message: 'Section kinds and order must be unique' });
}).readonly();
export const ArchiveSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128);
export const ArchivePublicationEvidenceSchema = z.strictObject({
  sourceReference: z.string().trim().min(1).max(500), rightsReference: z.string().trim().min(1).max(500),
  confirmedForPublication: z.literal(true),
}).readonly();
export const ArchiveAdminItemSchema = z.strictObject({
  id: z.uuid(), slug: ArchiveSlugSchema, status: z.enum(ARCHIVE_STATUSES), revision: z.number().int().positive(),
  content: ArchiveContentSchema, createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  allowedActions: z.array(z.enum(['edit', 'publish', 'archive'])).readonly(),
}).readonly();
export const ArchivePublicItemSchema = z.strictObject({
  id: z.uuid(), slug: ArchiveSlugSchema, status: z.literal('completed'), ...shared,
  sections: z.array(ArchivePublicSectionSchema).readonly(), publishedAt: z.iso.datetime(),
}).readonly();
export const ArchiveAdminPageSchema = pageSchema(ArchiveAdminItemSchema);
export const ArchivePublicPageSchema = pageSchema(ArchivePublicItemSchema);
export const CreateArchiveSchema = z.strictObject({ actionId: z.uuid(), slug: ArchiveSlugSchema, content: ArchiveContentSchema }).readonly();
export const UpdateArchiveSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive(),
  content: ArchiveContentSchema }).readonly();
export const ArchiveTransitionSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive() }).readonly();
export const PublishArchiveSchema = ArchiveTransitionSchema.unwrap().extend({ evidence: ArchivePublicationEvidenceSchema }).readonly();
export type ArchiveContent = z.infer<typeof ArchiveContentSchema>;
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];
export type ArchiveSectionKind = (typeof ARCHIVE_SECTION_KINDS)[number];
export type ArchivePublicItem = z.infer<typeof ArchivePublicItemSchema>;
