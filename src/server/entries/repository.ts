import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EntryDetailSchema, EntryIdSchema, ParticipantDraftSchema, WorkDraftSchema, GuardianDraftSchema, LocalizedTextSchema, PaymentSummarySchema } from "../../contracts/index.ts";
import type { CompetitionId, EntryDetail, EntryId, Page, UpdateEntryRequest } from "../../contracts/index.ts";
import type { EntryDatabase, SqlConnection } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { CompetitionRowSchema, draftPolicyError } from "../competitions/policy.ts";
import { createSubmissionService } from "./submissions.ts";
import type { SubmitEntryRequest, SubmissionReadiness, SubmissionResult } from "../../contracts/submissions.ts";

const policySchema = CompetitionRowSchema;
const rowSchema = z.object({ id: EntryIdSchema, competition_id: z.string(), status: z.string(), revision: z.number(), submitted_at: z.coerce.date().nullable(),
  received_at: z.coerce.date().nullable(), receipt_number: z.string().nullable(),
  review_status: z.enum(["not_started", "under_review", "completed"]).default("not_started"),
  published_result: z.enum(["official_selection", "finalist", "not_selected"]).nullable().default(null),
  final_participation_revision: z.number().int().nullable().default(null),
  final_participation_state: z.enum(["invited", "confirmation_pending", "confirmed", "declined"]).nullable().default(null),
  invitation_published_at: z.coerce.date().nullable().default(null), final_participation_confirmed_at: z.coerce.date().nullable().default(null),
  final_participation_order_id: z.uuid().nullable().default(null),
  certificate_count: z.number().int().nonnegative().default(0),
  payment: PaymentSummarySchema.nullable().default(null), payment_needs_review: z.boolean().default(false),
  participant: ParticipantDraftSchema, work: WorkDraftSchema, guardian: GuardianDraftSchema,
  snapshot: z.unknown().nullable().default(null) });
type EntryRow = z.infer<typeof rowSchema>;
type Policy = z.infer<typeof policySchema>;

const displayContentSchema = z.object({
  title: LocalizedTextSchema,
  formSpec: z.object({ categories: z.array(z.object({ id: z.string(), label: LocalizedTextSchema })) }).passthrough().nullable().optional(),
}).passthrough();
const displaySnapshotSchema = z.object({
  work: WorkDraftSchema,
  competition: z.object({ public_content: z.unknown().nullable() }).passthrough(),
}).passthrough();

export interface EntryRepository {
  create(owner: string, competitionId: CompetitionId, key: string): Promise<EntryDetail>;
  get(owner: string, id: EntryId): Promise<EntryDetail>;
  list(owner: string, cursor: string | null, limit: number): Promise<Page<EntryDetail>>;
  update(owner: string, id: EntryId, input: UpdateEntryRequest): Promise<EntryDetail>;
  readiness(owner: string, id: EntryId, locale: "en" | "ko"): Promise<SubmissionReadiness>;
  submit(owner: string, id: EntryId, key: string, input: SubmitEntryRequest): Promise<SubmissionResult>;
}

function policyError(policy: Policy, now: Date): EntryFault | null {
  return draftPolicyError(policy, now);
}

function detail(row: EntryRow, policy: Policy, now: Date): EntryDetail {
  if (row.status !== "draft" && row.status !== "submitted" && row.status !== "received" && row.status !== "withdrawn") throw new EntryFault("ENTRY_LOCKED", 409);
  const withdrawn = row.status === "withdrawn";
  const submitted = row.status !== "draft";
  const blocked = submitted ? null : policyError(policy, now);
  const participation = row.final_participation_state === null
    ? { state: "not_available" as const, revision: 0, invitationPublishedAt: null, confirmedAt: null, orderId: null, allowedActions: [] }
    : { state: row.final_participation_state, revision: row.final_participation_revision ?? 0,
      invitationPublishedAt: row.invitation_published_at?.toISOString() ?? null,
      confirmedAt: row.final_participation_confirmed_at?.toISOString() ?? null, orderId: row.final_participation_order_id,
      allowedActions: row.final_participation_state === "invited" ? ["respond_final_participation" as const] : [] };
  const allowedActions = withdrawn ? [] : submitted
    ? ["view_submission", ...(row.certificate_count > 0 ? ["download_certificate" as const] : [])]
    : blocked === null ? ["edit"] as const : [];
  const frozen = displaySnapshotSchema.safeParse(row.snapshot);
  const displayWork = frozen.success ? frozen.data.work : row.work;
  const frozenContent = frozen.success ? displayContentSchema.safeParse(frozen.data.competition.public_content) : null;
  const currentContent = displayContentSchema.safeParse(policy.public_content);
  const content = frozenContent?.success ? frozenContent.data : currentContent.success ? currentContent.data : null;
  const competitionTitle = content?.title ?? { en: row.competition_id, ko: row.competition_id };
  const workTitle = displayWork.englishTitle?.trim() || displayWork.title?.trim() || "";
  const categoryLabel = displayWork.category === undefined || displayWork.category.trim() === "" ? null
    : content?.formSpec?.categories.find((category) => category.id === displayWork.category)?.label ?? null;
  return EntryDetailSchema.parse({ id: row.id, competitionId: row.competition_id, revision: row.revision,
    competitionTitle, workTitle, categoryLabel,
    entryStatus: row.status, receiptNumber: row.receipt_number, submittedAt: row.submitted_at?.toISOString() ?? null,
    receivedAt: row.received_at?.toISOString() ?? null, payment: row.payment,
    reviewStatus: row.review_status, publishedResult: row.published_result,
    finalParticipation: participation,
    guardianVerification: { method: "not_configured", status: submitted ? "not_required" : "required" },
    allowedActions,
    blockingReasons: withdrawn ? ["ENTRY_LOCKED"] : row.status === "received" ? [] : row.payment_needs_review ? ["RECEIPT_PENDING"]
      : row.payment?.state === "succeeded" ? ["RECEIPT_PENDING"]
      : submitted ? ["PAYMENT_REQUIRED", "PAYMENT_UNAVAILABLE"] : blocked === null ? ["REQUIRED_FIELDS_MISSING", "POLICY_NOT_CONFIGURED"] : [blocked.code],
    participant: row.participant, work: row.work, guardian: row.guardian,
  });
}

async function readPolicy(db: SqlConnection, competitionId: string, lock = false): Promise<Policy> {
  const result = await db.query(`SELECT * FROM gyca_competitions WHERE id=$1${lock ? " FOR SHARE" : ""}`, [competitionId]);
  const row = result.rows[0];
  if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
  return policySchema.parse(row);
}

async function owned(db: SqlConnection, owner: string, id: string, lock = false): Promise<EntryRow> {
  const result = await db.query(`SELECT e.*, CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object(
    'orderId',o.id,'state',o.state,'amountMinor',o.amount_minor,'currency',o.currency) END AS payment,
    COALESCE(o.needs_review,false) AS payment_needs_review, s.snapshot
    FROM gyca_entries e LEFT JOIN gyca_orders o ON o.entry_id=e.id LEFT JOIN gyca_submissions s ON s.entry_id=e.id
    WHERE e.id=$1 AND e.owner_id=$2${lock ? " FOR UPDATE OF e" : ""}`, [id, owner]);
  const row = result.rows[0];
  if (row === undefined) throw new EntryFault("NOT_FOUND", 404);
  return rowSchema.parse(row);
}

export function createEntryRepository(database: EntryDatabase, now: () => Date): EntryRepository {
  return {
    ...createSubmissionService(database, now),
    create: (owner, competitionId, key) => database.transaction(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [JSON.stringify([owner, key])]);
      const existing = await db.query("SELECT competition_id, entry_id FROM gyca_entry_creation_keys WHERE owner_id=$1 AND key=$2", [owner, key]);
      const first = existing.rows[0];
      if (first !== undefined) {
        const previous = z.object({ competition_id: z.string(), entry_id: EntryIdSchema }).parse(first);
        if (previous.competition_id !== competitionId) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return detail(await owned(db, owner, previous.entry_id), await readPolicy(db, competitionId), now());
      }
      const policy = await readPolicy(db, competitionId, true);
      const blocked = policyError(policy, now());
      if (blocked !== null) throw blocked;
      const id = randomUUID();
      await db.query("INSERT INTO gyca_entries(id, owner_id, competition_id) VALUES($1,$2,$3)", [id, owner, competitionId]);
      await db.query("INSERT INTO gyca_entry_creation_keys(owner_id,key,competition_id,entry_id) VALUES($1,$2,$3,$4)", [owner, key, competitionId, id]);
      return detail(await owned(db, owner, id), policy, now());
    }),
    get: async (owner, id) => {
      const row = await owned(database, owner, id);
      return detail(row, await readPolicy(database, row.competition_id), now());
    },
    list: async (owner, cursor, limit) => {
      const result = await database.query(`SELECT e.*,
        CASE WHEN o.id IS NULL THEN NULL ELSE jsonb_build_object('orderId',o.id,'state',o.state,'amountMinor',o.amount_minor,'currency',o.currency) END AS payment,
        COALESCE(o.needs_review,false) AS payment_needs_review,
        s.snapshot,
        c.id AS policy_id, c.slug, c.published, c.draft_enabled, c.opens_at, c.closes_at, c.phase, c.public_content, c.payment_enabled, c.payment_closes_at FROM gyca_entries e JOIN gyca_competitions c ON c.id=e.competition_id
        LEFT JOIN gyca_orders o ON o.entry_id=e.id
        LEFT JOIN gyca_submissions s ON s.entry_id=e.id
        WHERE e.owner_id=$1 AND ($2::uuid IS NULL OR e.id>$2::uuid) ORDER BY e.id LIMIT $3`, [owner, cursor, limit + 1]);
      const rows = z.array(rowSchema.extend(policySchema.omit({ id: true }).shape).extend({ policy_id: z.string() })).parse(result.rows);
      const page = rows.slice(0, limit);
      const items = page.map((row) => detail(row, policySchema.parse({ ...row, id: row.policy_id }), now()));
      return { items, nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
    },
    update: (owner, id, input) => database.transaction(async (db) => {
      const row = await owned(db, owner, id, true);
      if (row.status !== "draft") throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
      const policy = await readPolicy(db, row.competition_id, true);
      const blocked = policyError(policy, now());
      if (blocked !== null) throw blocked;
      await db.query(`UPDATE gyca_entries SET participant=participant || $3::jsonb, work=work || $4::jsonb,
        guardian=guardian || $5::jsonb, revision=revision+1, updated_at=clock_timestamp()
        WHERE id=$1 AND owner_id=$2`,
      [id, owner, JSON.stringify(input.participant ?? {}), JSON.stringify(input.work ?? {}), JSON.stringify(input.guardian ?? {})]);
      return detail(await owned(db, owner, id), policy, now());
    }),
  };
}
