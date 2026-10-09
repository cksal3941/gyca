import { z } from "zod";

export const ENTRY_STATUSES = ["draft", "submitted", "received", "withdrawn", "expired"] as const;
export const REVIEW_STATUSES = ["not_started", "under_review", "completed"] as const;
export const PUBLISHED_RESULTS = ["official_selection", "finalist", "not_selected"] as const;
export const COMPETITION_STATUSES = ["upcoming", "open", "closed", "judging", "result", "archived"] as const;
export const PAYMENT_STATES = ["pending", "succeeded", "failed", "cancelled", "expired"] as const;
export const ENTRY_ACTIONS = ["edit", "upload", "submit", "start_payment", "check_payment", "view_submission", "download_certificate"] as const;
export const COMPETITION_ACTIONS = ["start_entry", "view_guidelines"] as const;
export const BLOCKING_REASONS = ["NOT_OPEN_YET", "DEADLINE_PASSED", "COMPETITION_ARCHIVED", "POLICY_NOT_CONFIGURED", "PAYMENT_UNAVAILABLE", "ENTRY_LOCKED", "REQUIRED_FIELDS_MISSING", "FILE_NOT_READY", "CONSENT_REQUIRED", "GUARDIAN_VERIFICATION_REQUIRED", "PAYMENT_REQUIRED", "PAYMENT_PENDING", "RECEIPT_PENDING"] as const;
export const REJECTION_CODES = ["FILE_TOO_LARGE", "UNSUPPORTED_MEDIA_TYPE", "CONTENT_TYPE_MISMATCH", "FILE_CORRUPTED", "PDF_ENCRYPTED", "PDF_TOO_FEW_PAGES", "FILE_UNSAFE"] as const;
export const FIELD_ERROR_CODES = ["REQUIRED", "INVALID_FORMAT", "TOO_LONG", "INVALID_CHOICE", "INVALID_DATE", "AGE_OUT_OF_RANGE"] as const;
export const ERROR_CODES = ["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "REVISION_CONFLICT", "IDEMPOTENCY_CONFLICT", "ENTRY_LOCKED", "DEADLINE_PASSED", "NOT_OPEN_YET", "COMPETITION_ARCHIVED", "FILE_NOT_READY", "VALIDATION_FAILED", "CONSENT_REQUIRED", "GUARDIAN_VERIFICATION_REQUIRED", "FILE_TOO_LARGE", "RATE_LIMITED", "PAYMENT_UNAVAILABLE", "POLICY_NOT_CONFIGURED", "INTERNAL_ERROR", "STORAGE_UNAVAILABLE", "UPLOAD_EXPIRED", "UPLOAD_LIMIT_REACHED"] as const;
export const ASSET_PURPOSES = ["cover_image", "book_pdf", "copyright_declaration", "guardian_consent", "publisher_permission"] as const;
export const FORM_FIELD_PATHS = ["participant.name", "participant.nameEn", "participant.dateOfBirth", "participant.residenceCountry", "participant.nationality", "participant.school", "participant.grade", "guardian.name", "guardian.email", "work.title", "work.description", "work.englishTitle", "work.englishDescription", "work.creatorBio", "work.category", "work.language", "work.publicationStatus"] as const;

export type EntryStatus = (typeof ENTRY_STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type PublishedResult = (typeof PUBLISHED_RESULTS)[number];
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];
export type PaymentState = (typeof PAYMENT_STATES)[number];
export type EntryAction = (typeof ENTRY_ACTIONS)[number];
export type CompetitionAction = (typeof COMPETITION_ACTIONS)[number];
export type BlockingReason = (typeof BLOCKING_REASONS)[number];
export type RejectionCode = (typeof REJECTION_CODES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

const identifier = z.string().min(1).max(128);
export const EntryIdSchema = identifier.brand<"EntryId">();
export const CompetitionIdSchema = identifier.brand<"CompetitionId">();
export const OrderIdSchema = identifier.brand<"OrderId">();
export const AssetIdSchema = identifier.brand<"AssetId">();
export const CertificateIdSchema = identifier.brand<"CertificateId">();
export const UtcTimestampSchema = z.iso.datetime().brand<"UtcTimestamp">();
export const DateOnlySchema = z.iso.date().brand<"DateOnly">();
export type EntryId = z.infer<typeof EntryIdSchema>;
export type CompetitionId = z.infer<typeof CompetitionIdSchema>;
export type OrderId = z.infer<typeof OrderIdSchema>;
export type UtcTimestamp = z.infer<typeof UtcTimestampSchema>;

const nullableTime = UtcTimestampSchema.nullable();
const text = z.string();
const nonempty = z.string().min(1);
export const LocalizedTextSchema = z.object({ en: text, ko: text }).readonly();
const amountMinorSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const MoneySchema = z.object({ amountMinor: amountMinorSchema, currency: z.literal("EUR") }).readonly();
export type Money = z.infer<typeof MoneySchema>;
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

const dateRange = z.object({ startsOn: DateOnlySchema, endsOn: DateOnlySchema })
  .refine((v) => v.startsOn <= v.endsOn, { message: "Reversed date range" }).readonly();
export const KeyDateSchema = z.object({
  id: identifier, label: LocalizedTextSchema, timezone: nonempty,
  value: z.union([
    z.object({ kind: z.literal("date"), date: DateOnlySchema }).readonly(),
    z.object({ kind: z.literal("instant"), at: UtcTimestampSchema }).readonly(),
    z.object({ kind: z.literal("date_range"), startsOn: DateOnlySchema, endsOn: DateOnlySchema })
      .refine((v) => v.startsOn <= v.endsOn).readonly(),
  ]).nullable(),
}).readonly();

export const FormSpecSchema = z.object({
  version: nonempty, ageReferenceDate: DateOnlySchema.nullable(),
  categories: z.array(z.object({ id: identifier, label: LocalizedTextSchema }).readonly()).readonly(),
  ageGroups: z.array(z.object({ id: identifier, label: LocalizedTextSchema,
    minAgeInclusive: z.number().int().nonnegative(), maxAgeInclusive: z.number().int().nonnegative(),
  }).refine((v) => v.minAgeInclusive <= v.maxAgeInclusive).readonly()).readonly(),
  fields: z.array(z.object({ path: z.enum(FORM_FIELD_PATHS), inputType: z.enum(["text", "textarea", "choice", "date", "email"]), requiredOnSubmit: z.boolean().nullable() }).readonly()).readonly(),
  uploads: z.array(z.object({ purpose: z.enum(ASSET_PURPOSES), requiredOnSubmit: z.boolean().nullable(),
    allowedMediaTypes: z.array(nonempty).min(1).readonly(), maxFiles: z.number().int().positive(),
    maxBytes: z.number().int().positive().nullable(), minPages: z.number().int().positive().nullable(),
  }).readonly()).readonly(),
}).readonly();

export const ExhibitionSchema = z.object({
  approvalStatus: z.enum(["pending", "approved"]), displayName: LocalizedTextSchema,
  venueName: nonempty.nullable(), logoUrl: z.url().nullable(), period: dateRange.nullable(),
}).refine((v) => v.approvalStatus !== "pending" || (v.venueName === null && v.logoUrl === null),
  { message: "Unapproved venue and logo must not be disclosed" }).readonly();

export const CompetitionSchema = z.object({
  id: CompetitionIdSchema, slug: nonempty, status: z.enum(COMPETITION_STATUSES), title: LocalizedTextSchema,
  fee: MoneySchema.nullable(), readiness: z.object({ application: z.boolean(), payment: z.boolean() }).readonly(),
  allowedActions: z.array(z.enum(COMPETITION_ACTIONS)).readonly(), blockingReasons: z.array(z.enum(BLOCKING_REASONS)).readonly(),
  opensAt: nullableTime, submissionClosesAtExclusive: nullableTime, paymentClosesAtExclusive: nullableTime,
  timezone: nonempty, keyDates: z.array(KeyDateSchema).readonly(), formSpec: FormSpecSchema.nullable(),
  exhibition: ExhibitionSchema.nullable(),
  guidelines: z.object({ url: z.url(), locale: z.enum(["en", "ko"]), version: nonempty }).readonly().nullable(),
}).superRefine((v, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: "custom", message });
  if (v.allowedActions.includes("view_guidelines") && v.guidelines === null) reject("Guidelines unavailable");
  if (v.allowedActions.includes("start_entry") && (v.status !== "open" || !v.readiness.application)) reject("Entry unavailable");
  if (v.readiness.application && (v.formSpec === null || v.opensAt === null || v.submissionClosesAtExclusive === null
    || v.formSpec.ageReferenceDate === null || v.formSpec.fields.some((f) => f.requiredOnSubmit === null)
    || v.formSpec.uploads.some((f) => f.requiredOnSubmit === null || f.maxBytes === null))) reject("Unresolved application policy");
  if (v.readiness.payment && (v.fee === null || v.paymentClosesAtExclusive === null)) reject("Unresolved payment policy");
  if (v.opensAt !== null && v.submissionClosesAtExclusive !== null && Date.parse(v.opensAt) >= Date.parse(v.submissionClosesAtExclusive)) reject("Invalid entry window");
}).readonly();
export type Competition = z.infer<typeof CompetitionSchema>;
export type FormSpec = z.infer<typeof FormSpecSchema>;

export const GuardianVerificationSchema = z.object({
  method: z.enum(["not_configured", "checkbox", "email"]),
  status: z.enum(["not_required", "required", "pending", "verified", "failed", "expired"]),
}).refine((v) => v.method !== "not_configured" || v.status === "required" || v.status === "not_required").readonly();
export const FinalParticipationSchema = z.object({
  state: z.enum(["not_available", "invited", "confirmation_pending", "confirmed", "declined"]),
  revision: z.number().int().nonnegative(), invitationPublishedAt: nullableTime, confirmedAt: nullableTime, orderId: OrderIdSchema.nullable(),
  allowedActions: z.array(z.literal("respond_final_participation")).readonly(),
}).superRefine((v, ctx) => {
  if (v.state === "confirmed" && v.confirmedAt === null) ctx.addIssue({ code: "custom", message: "Confirmed participation requires time" });
  if ((v.state === "invited") !== v.allowedActions.includes("respond_final_participation"))
    ctx.addIssue({ code: "custom", message: "Participation action does not match state" });
}).readonly();
export const PaymentSummarySchema = z.object({
  orderId: OrderIdSchema, state: z.enum(PAYMENT_STATES), amountMinor: amountMinorSchema, currency: z.literal("EUR"),
}).readonly();
export const EntrySummarySchema = z.object({
  id: EntryIdSchema, competitionId: CompetitionIdSchema, revision: z.number().int().positive(),
  competitionTitle: LocalizedTextSchema, workTitle: z.string(), categoryLabel: LocalizedTextSchema.nullable(),
  entryStatus: z.enum(ENTRY_STATUSES), receiptNumber: nonempty.nullable(), submittedAt: nullableTime, receivedAt: nullableTime,
  payment: PaymentSummarySchema.nullable(), reviewStatus: z.enum(REVIEW_STATUSES), publishedResult: z.enum(PUBLISHED_RESULTS).nullable(),
  finalParticipation: FinalParticipationSchema, guardianVerification: GuardianVerificationSchema,
  allowedActions: z.array(z.enum(ENTRY_ACTIONS)).readonly(), blockingReasons: z.array(z.enum(BLOCKING_REASONS)).readonly(),
}).superRefine((v, ctx) => {
  if (v.entryStatus === "received" && (v.receiptNumber === null || v.receivedAt === null || v.submittedAt === null || v.payment?.state !== "succeeded"))
    ctx.addIssue({ code: "custom", message: "Received entry requires receipt and verified payment" });
  if ((v.entryStatus === "draft" || v.entryStatus === "submitted") && (v.receiptNumber !== null || v.receivedAt !== null))
    ctx.addIssue({ code: "custom", message: "Receipt not yet issued" });
  if (v.payment?.state === "succeeded" && v.allowedActions.includes("start_payment"))
    ctx.addIssue({ code: "custom", message: "Payment already succeeded" });
}).readonly();
export type EntrySummary = z.infer<typeof EntrySummarySchema>;

const draftText = z.string().max(20000);
export const ParticipantDraftSchema = z.strictObject({ name: draftText.optional(), nameEn: draftText.optional(),
  dateOfBirth: DateOnlySchema.nullable().optional(), residenceCountry: draftText.optional(), nationality: draftText.optional(),
  school: draftText.optional(), grade: draftText.optional(),
}).readonly();
export const WorkDraftSchema = z.strictObject({ title: draftText.optional(), description: draftText.optional(),
  englishTitle: draftText.optional(), englishDescription: draftText.optional(), creatorBio: draftText.optional(),
  category: draftText.optional(), language: draftText.optional(), publicationStatus: z.enum(["published", "unpublished"]).nullable().optional(),
}).readonly();
export const UpdateEntryRequestSchema = z.strictObject({
  revision: z.number().int().positive(), participant: ParticipantDraftSchema.optional(), work: WorkDraftSchema.optional(),
  guardian: z.strictObject({ name: draftText.optional(), email: z.union([z.literal(""), z.email()]).optional() }).readonly().optional(),
}).refine((v) => v.participant !== undefined || v.work !== undefined || v.guardian !== undefined).readonly();
export type UpdateEntryRequest = z.infer<typeof UpdateEntryRequestSchema>;

export const CreateEntryRequestSchema = z.strictObject({ competitionId: CompetitionIdSchema }).readonly();
export const GuardianDraftSchema = z.strictObject({ name: draftText.optional(), email: z.union([z.literal(""), z.email()]).optional() }).readonly();
export const EntryDetailSchema = z.intersection(EntrySummarySchema, z.object({
  participant: ParticipantDraftSchema, work: WorkDraftSchema, guardian: GuardianDraftSchema,
}).readonly());
export type EntryDetail = z.infer<typeof EntryDetailSchema>;

export const AssetSchema = z.object({ id: AssetIdSchema, purpose: z.enum(ASSET_PURPOSES), displayName: nonempty,
  sizeBytes: z.number().int().nonnegative(), state: z.enum(["pending_upload", "uploaded", "validating", "ready", "rejected"]),
  pageCount: z.number().int().nonnegative().nullable(), rejectionCode: z.enum(REJECTION_CODES).nullable(),
}).refine((v) => (v.state === "rejected") === (v.rejectionCode !== null)).readonly();
export type Asset = z.infer<typeof AssetSchema>;

export const CertificateSummarySchema = z.object({ id: CertificateIdSchema, entryId: EntryIdSchema,
  competitionTitle: LocalizedTextSchema, workTitle: text, stage: z.enum(["official_selection", "finalist"]),
  issuedAt: UtcTimestampSchema, allowedActions: z.array(z.literal("download_certificate")).readonly(),
}).readonly();
export const OrderSummarySchema = z.object({ id: OrderIdSchema, entryId: EntryIdSchema,
  competitionTitle: LocalizedTextSchema, workTitle: text, kind: z.enum(["entry_fee", "final_participation"]),
  money: MoneySchema, paymentState: z.enum(PAYMENT_STATES), createdAt: UtcTimestampSchema,
  refundSummary: z.object({ amountMinor: amountMinorSchema, state: z.enum(["pending", "succeeded", "failed"]) }).readonly().nullable(),
}).readonly();
export type CertificateSummary = z.infer<typeof CertificateSummarySchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;

export const ResponseMetaSchema = z.object({ requestId: identifier, serverTime: UtcTimestampSchema }).readonly();
export const ApiErrorSchema = z.object({ code: z.enum(ERROR_CODES), message: text, retryable: z.boolean(),
  fieldErrors: z.array(z.object({ path: text, code: z.enum(FIELD_ERROR_CODES) }).readonly()).readonly(),
}).readonly();
export const ApiFailureSchema = z.object({ error: ApiErrorSchema, meta: ResponseMetaSchema }).readonly();
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiFailure = z.infer<typeof ApiFailureSchema>;
export function apiSuccessSchema<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: ResponseMetaSchema }).readonly();
}
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item).readonly(), nextCursor: z.string().nullable() }).readonly();
}
export type ApiSuccess<T> = { readonly data: T; readonly meta: z.infer<typeof ResponseMetaSchema> };
export type Page<T> = { readonly items: readonly T[]; readonly nextCursor: string | null };
