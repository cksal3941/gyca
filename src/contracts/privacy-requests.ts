import { z } from "zod";
import { UtcTimestampSchema, pageSchema } from "./index.ts";

export const PRIVACY_REQUEST_STATES = ["submitted", "under_review", "retention_hold", "approved_for_execution", "cancelled"] as const;
export const PRIVACY_REASON_CODES = ["USER_REQUESTED", "REVIEW_STARTED", "LEGAL_RETENTION", "PAYMENT_RECORD_RETENTION",
  "CONTEST_EVIDENCE_RETENTION", "REVIEW_RESUMED", "NO_RETENTION_BLOCK", "USER_CANCELLED"] as const;
const baseShape = { id: z.uuid(), kind: z.literal("account_closure_and_erasure"), state: z.enum(PRIVACY_REQUEST_STATES),
  revision: z.number().int().positive(), requestedAt: UtcTimestampSchema, updatedAt: UtcTimestampSchema } as const;
export const PrivacyRequestSchema = z.object({ ...baseShape,
  allowedActions: z.array(z.literal("cancel_privacy_request")).max(1).readonly(),
}).superRefine((value, ctx) => {
  if ((value.state === "submitted") !== value.allowedActions.includes("cancel_privacy_request"))
    ctx.addIssue({ code: "custom", message: "Privacy request action does not match state" });
}).readonly();
export const PrivacyRequestPageSchema = pageSchema(PrivacyRequestSchema);
export const CreatePrivacyRequestSchema = z.strictObject({ actionId: z.uuid(), kind: z.literal("account_closure_and_erasure") }).readonly();
export const CancelPrivacyRequestSchema = z.strictObject({ actionId: z.uuid(), expectedRevision: z.number().int().positive() }).readonly();

const adminAction = z.enum(["start_review", "place_retention_hold", "resume_review", "approve_for_execution"]);
export const AdminPrivacyRequestSchema = z.object({ ...baseShape, requester: z.object({ accountId: z.string().min(1).max(128),
  email: z.string().min(1).max(320) }).readonly(), lastTransition: z.object({ reasonCode: z.enum(PRIVACY_REASON_CODES),
  evidenceReference: z.string().min(1).max(500).nullable(), at: UtcTimestampSchema }).readonly(),
  allowedActions: z.array(adminAction).readonly(),
}).readonly();
export const AdminPrivacyRequestPageSchema = pageSchema(AdminPrivacyRequestSchema);
const reviewBase = { actionId: z.uuid(), expectedRevision: z.number().int().positive() } as const;
export const ReviewPrivacyRequestSchema = z.discriminatedUnion("decision", [
  z.strictObject({ ...reviewBase, decision: z.literal("start_review") }),
  z.strictObject({ ...reviewBase, decision: z.literal("resume_review") }),
  z.strictObject({ ...reviewBase, decision: z.literal("place_retention_hold"),
    reasonCode: z.enum(["LEGAL_RETENTION", "PAYMENT_RECORD_RETENTION", "CONTEST_EVIDENCE_RETENTION"]),
    evidenceReference: z.string().trim().min(1).max(500) }),
  z.strictObject({ ...reviewBase, decision: z.literal("approve_for_execution"), reasonCode: z.literal("NO_RETENTION_BLOCK"),
    evidenceReference: z.string().trim().min(1).max(500) }),
]).readonly();
export type PrivacyRequest = z.infer<typeof PrivacyRequestSchema>;
export type ReviewPrivacyRequest = z.infer<typeof ReviewPrivacyRequestSchema>;
