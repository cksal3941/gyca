import { z } from "zod";

const text = z.string().trim().min(1).max(10000);
export const RubricCriterionSchema = z.strictObject({ id: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  label: text.max(200), description: z.string().max(2000), maxScore: z.number().int().min(1).max(100) }).readonly();
export const ReviewRubricSchema = z.strictObject({ version: text.max(100), criteria: z.array(RubricCriterionSchema).min(1).max(20).readonly(),
  editableAfterSubmit: z.boolean() }).refine(value => new Set(value.criteria.map(item => item.id)).size === value.criteria.length).readonly();
export const UpdateReviewRubricSchema = z.strictObject({ competitionRevision: z.number().int().positive(), rubric: ReviewRubricSchema }).readonly();
export const ReviewRubricDetailSchema = z.strictObject({ competitionId: text.max(128), competitionRevision: z.number().int().positive(),
  rubric: ReviewRubricSchema.nullable() }).readonly();

export const CreateJudgeAssignmentSchema = z.strictObject({ entryId: z.uuid(), judgeId: text.max(128),
  blindCode: z.string().regex(/^[A-Z0-9-]{3,64}$/), actionId: z.string().regex(/^[\x21-\x7e]{1,128}$/) }).readonly();
export const JudgeAssignmentSchema = z.strictObject({ id: z.uuid(), code: z.string(), category: z.string(), ageGroup: z.string(),
  reviewState: z.enum(["not_started", "in_progress", "submitted"]), editableAfterSubmit: z.boolean() }).readonly();
export const JudgeAssignmentsSchema = z.array(JudgeAssignmentSchema).readonly();
export const ReviewDraftSchema = z.strictObject({ scores: z.record(z.string(), z.number()), comment: z.string().max(10000) }).readonly();
export const SaveJudgeReviewSchema = z.strictObject({ expectedRevision: z.number().int().nonnegative(), draft: ReviewDraftSchema }).readonly();
export const JudgeReviewContextSchema = z.strictObject({ assignment: JudgeAssignmentSchema, rubric: z.array(RubricCriterionSchema).readonly(),
  draft: ReviewDraftSchema, submitted: z.boolean(), editableAfterSubmit: z.boolean(), revision: z.number().int().nonnegative(),
  pdf: z.strictObject({ blindedName: z.string(), url: z.url(), expiresAt: z.iso.datetime() }).nullable(),
  blockingReasons: z.array(z.literal("BLINDED_FILE_NOT_READY")).readonly() }).readonly();
export const JudgeReviewMutationSchema = z.strictObject({ revision: z.number().int().positive(), state: z.enum(["in_progress", "submitted"]),
  savedAt: z.iso.datetime(), submittedAt: z.iso.datetime().nullable() }).readonly();

export const JudgeAccountSchema = z.strictObject({ userId: text.max(128), email: z.email(), name: text.max(200), active: z.boolean(),
  createdAt: z.iso.datetime(), unfinishedAssignments: z.number().int().nonnegative() }).readonly();
export const JudgeAccountsSchema = z.array(JudgeAccountSchema).readonly();
export const UpdateJudgeAccountSchema = z.strictObject({ expectedActive: z.boolean().nullable(), active: z.boolean(),
  reason: text.max(1000) }).readonly();

export const BlindAssetStateSchema = z.enum(["pending", "running", "pending_review", "approved", "stalled"]);
export const BlindAssetAdminSchema = z.strictObject({ assignmentId: z.uuid(), state: BlindAssetStateSchema,
  attempts: z.number().int().nonnegative(), lastErrorCode: z.string().nullable(), candidate: z.strictObject({ version: z.string(), checksum: z.string(),
    pageCount: z.number().int().positive(), url: z.url(), expiresAt: z.iso.datetime() }).nullable(), approvedAt: z.iso.datetime().nullable() }).readonly();
export const ApproveBlindAssetSchema = z.strictObject({ candidateVersion: text.max(1024), candidateChecksum: text.max(256),
  confirmedNoVisibleIdentity: z.literal(true), note: text.max(2000) }).readonly();

export const JudgeReviewStateSchema = z.enum(["not_started", "in_progress", "submitted"]);
export const AdminJudgeAssignmentSchema = z.strictObject({ id: z.uuid(), entryId: z.uuid(), receiptNumber: z.string(), code: z.string(),
  judge: z.strictObject({ userId: text.max(128), name: text.max(200), email: z.email(), active: z.boolean() }).readonly(),
  rubricVersion: z.string(), reviewState: JudgeReviewStateSchema, reviewRevision: z.number().int().nonnegative(),
  blindAssetState: BlindAssetStateSchema, createdAt: z.iso.datetime(), revokedAt: z.iso.datetime().nullable(),
  revocationReason: z.string().nullable(), replacementAssignmentId: z.uuid().nullable(),
  allowedActions: z.array(z.enum(["revoke_assignment", "reassign_assignment"])).readonly() }).readonly();
export const AdminJudgeAssignmentsPageSchema = z.strictObject({ items: z.array(AdminJudgeAssignmentSchema).readonly(),
  nextCursor: z.uuid().nullable() }).readonly();
export const ListJudgeAssignmentsQuerySchema = z.strictObject({ cursor: z.uuid().nullable().default(null),
  limit: z.coerce.number().int().min(1).max(100).default(50) }).readonly();
const assignmentChangeBase = { expectedReviewState: z.enum(["not_started", "in_progress"]),
  expectedReviewRevision: z.number().int().nonnegative(), reason: text.max(1000),
  actionId: z.string().regex(/^[\x21-\x7e]{1,128}$/) } as const;
export const RevokeJudgeAssignmentSchema = z.strictObject(assignmentChangeBase).refine(value => value.expectedReviewState === "not_started").readonly();
export const ReassignJudgeAssignmentSchema = z.strictObject({ ...assignmentChangeBase, judgeId: text.max(128),
  blindCode: z.string().regex(/^[A-Z0-9-]{3,64}$/) }).readonly();
export const JudgeAssignmentChangeSchema = z.strictObject({ revokedAssignmentId: z.uuid(), replacement: JudgeAssignmentSchema.nullable(),
  changedAt: z.iso.datetime() }).readonly();
