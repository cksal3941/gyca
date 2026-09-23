import { z } from "zod";
import { CompetitionSchema } from "../../contracts/index.ts";
import type { Competition, CompetitionStatus, BlockingReason, CompetitionAction } from "../../contracts/index.ts";
import { EntryFault } from "../entries/errors.ts";
import { supportsUploadRule } from "../uploads/policy.ts";

export const CompetitionRowSchema = z.object({
  id: z.string(), slug: z.string(), published: z.boolean(), draft_enabled: z.boolean(),
  opens_at: z.coerce.date().nullable(), closes_at: z.coerce.date().nullable(),
  phase: z.enum(["scheduled", "judging", "result", "archived"]), public_content: z.unknown(),
  payment_enabled: z.boolean(), payment_closes_at: z.coerce.date().nullable(),
});
export type CompetitionRow = z.infer<typeof CompetitionRowSchema>;

const shape = CompetitionSchema.unwrap().shape;
const ContentSchema = z.object({ title: shape.title, fee: shape.fee, timezone: shape.timezone,
  keyDates: shape.keyDates, formSpec: shape.formSpec, exhibition: z.unknown(), guidelines: shape.guidelines });
const exhibitionDraft = z.object({ approvalStatus: z.enum(["pending", "approved"]), displayName: z.unknown(),
  venueName: z.unknown(), logoUrl: z.unknown(), period: z.unknown() });

function publicExhibition(input: unknown): unknown {
  if (input === null || input === undefined) return null;
  const value = exhibitionDraft.parse(input);
  switch (value.approvalStatus) {
    case "pending": return { ...value, venueName: null, logoUrl: null };
    case "approved": return value;
    default: { const impossible: never = value.approvalStatus; return impossible; }
  }
}

function status(row: CompetitionRow, now: Date): CompetitionStatus {
  switch (row.phase) {
    case "archived": return "archived";
    case "judging": return "judging";
    case "result": return "result";
    case "scheduled":
      if (row.opens_at === null || now < row.opens_at) return "upcoming";
      if (row.closes_at !== null && now >= row.closes_at) return "closed";
      return "open";
    default: { const impossible: never = row.phase; return impossible; }
  }
}

export function projectCompetition(row: CompetitionRow, now: Date): Competition | null {
  if (!row.published || row.public_content === null) return null;
  const content = ContentSchema.parse(row.public_content);
  const spec = content.formSpec;
  const phase = status(row, now);
  const application = row.draft_enabled && row.phase === "scheduled" && row.opens_at !== null && row.closes_at !== null
    && spec !== null && spec.ageReferenceDate !== null
    && spec.fields.every((f) => f.requiredOnSubmit !== null)
    && spec.uploads.every((f) => f.requiredOnSubmit !== null && supportsUploadRule(f));
  const payment = row.payment_enabled && row.phase === "scheduled" && content.fee !== null
    && content.fee.amountMinor > 0 && row.payment_closes_at !== null;
  const actions: CompetitionAction[] = [];
  const reasons: BlockingReason[] = [];
  if (application && phase === "open") actions.push("start_entry");
  if (content.guidelines !== null) actions.push("view_guidelines");
  switch (phase) {
    case "archived": reasons.push("COMPETITION_ARCHIVED"); break;
    case "upcoming": reasons.push("NOT_OPEN_YET"); break;
    case "closed": case "judging": case "result": reasons.push("DEADLINE_PASSED"); break;
    case "open": break;
    default: { const impossible: never = phase; return impossible; }
  }
  if (!application) reasons.push("POLICY_NOT_CONFIGURED");
  return CompetitionSchema.parse({ ...content, id: row.id, slug: row.slug, status: phase,
    exhibition: publicExhibition(content.exhibition), readiness: { application, payment },
    allowedActions: actions, blockingReasons: reasons, opensAt: row.opens_at?.toISOString() ?? null,
    submissionClosesAtExclusive: row.closes_at?.toISOString() ?? null,
    paymentClosesAtExclusive: row.payment_closes_at?.toISOString() ?? null });
}

export function draftPolicyError(row: CompetitionRow, now: Date): EntryFault | null {
  const competition = projectCompetition(row, now);
  if (competition === null) return new EntryFault("POLICY_NOT_CONFIGURED", 503);
  if (competition.allowedActions.includes("start_entry")) return null;
  if (competition.status === "archived") return new EntryFault("COMPETITION_ARCHIVED", 409);
  if (!competition.readiness.application) return new EntryFault("POLICY_NOT_CONFIGURED", 503);
  if (competition.status === "upcoming") return new EntryFault("NOT_OPEN_YET", 409);
  return new EntryFault("DEADLINE_PASSED", 409);
}
