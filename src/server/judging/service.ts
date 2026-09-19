import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CreateJudgeAssignmentSchema, JudgeAssignmentSchema, JudgeAssignmentsSchema, JudgeReviewContextSchema,
  JudgeReviewMutationSchema, ReviewRubricDetailSchema, ReviewRubricSchema, SaveJudgeReviewSchema, UpdateJudgeAccountSchema,
  UpdateReviewRubricSchema, JudgeAccountSchema, JudgeAccountsSchema } from "../../contracts/judge.ts";
import { ApproveBlindAssetSchema, BlindAssetAdminSchema } from "../../contracts/judge.ts";
import { AdminJudgeAssignmentSchema, AdminJudgeAssignmentsPageSchema, JudgeAssignmentChangeSchema,
  ListJudgeAssignmentsQuerySchema, ReassignJudgeAssignmentSchema, RevokeJudgeAssignmentSchema } from "../../contracts/judge.ts";
import type { EntryDatabase, SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import type { UploadStorage } from "../uploads/storage.ts";

async function admin(db: SqlConnection, actor: string) {
  if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
    throw new EntryFault("FORBIDDEN", 403);
}
const rubricRow = z.object({ version: z.string(), criteria: z.unknown(), editable_after_submit: z.boolean() });
const assignmentRow = z.object({ id: z.uuid(), blind_code: z.string(), entry_id: z.uuid(), category: z.string().nullable(), age_group: z.string().nullable(),
  editable_after_submit: z.boolean(), review_state: z.enum(["not_started", "in_progress", "submitted"]), rubric_version: z.string(),
  criteria: z.unknown(), revision: z.number().int().nullable(), scores: z.unknown().nullable(), comment: z.string().nullable(),
  submitted_at: z.date().nullable(), object_key: z.string().nullable(), object_version: z.string().nullable() });

function assignmentDto(row: z.infer<typeof assignmentRow>) {
  return JudgeAssignmentSchema.parse({ id: row.id, code: row.blind_code, category: row.category ?? "",
    ageGroup: row.age_group ?? "", reviewState: row.review_state, editableAfterSubmit: row.editable_after_submit });
}
function validateScores(rubric: z.infer<typeof ReviewRubricSchema>, scores: Readonly<Record<string, number>>, complete: boolean) {
  const allowed = new Map(rubric.criteria.map(item => [item.id, item.maxScore]));
  if (complete && Object.keys(scores).length !== allowed.size) throw new EntryFault("VALIDATION_FAILED", 422);
  for (const [id, score] of Object.entries(scores)) {
    const max = allowed.get(id);
    if (max === undefined || !Number.isFinite(score) || score < 0 || score > max) throw new EntryFault("VALIDATION_FAILED", 422);
  }
}
const assignmentSelect = `SELECT a.id,a.blind_code,a.entry_id,a.editable_after_submit,a.rubric_version,
  s.snapshot->'work'->>'category' AS category,s.snapshot->>'ageGroup' AS age_group,
  COALESCE(r.state,'not_started') AS review_state,r.revision,r.scores,r.comment,r.submitted_at,
  u.criteria,b.object_key,b.object_version
  FROM gyca_judge_assignments a JOIN gyca_submissions s ON s.entry_id=a.entry_id
  JOIN gyca_review_rubrics u ON u.competition_id=a.competition_id AND u.version=a.rubric_version
  LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
  LEFT JOIN gyca_blinded_review_assets b ON b.assignment_id=a.id
  LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id`;

export function createJudgingService(database: EntryDatabase, storage: UploadStorage | null, now: () => Date) {
  async function assigned(db: SqlConnection, judge: string, id: string, lock = false) {
    const raw = (await db.query(`${assignmentSelect} JOIN gyca_judges j ON j.user_id=a.judge_id
      WHERE a.id=$1 AND a.judge_id=$2 AND j.active=true AND v.assignment_id IS NULL${lock ? " FOR UPDATE OF a" : ""}`, [id, judge])).rows[0];
    if (!raw) throw new EntryFault("NOT_FOUND", 404);
    return assignmentRow.parse(raw);
  }
  async function mutate(judge: string, id: string, rawInput: unknown, submit: boolean) {
    const input = SaveJudgeReviewSchema.parse(rawInput);
    return database.transaction(async db => {
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [id]);
      const row = await assigned(db, judge, id, true);
      const rubric = ReviewRubricSchema.parse({ version: row.rubric_version, criteria: row.criteria,
        editableAfterSubmit: row.editable_after_submit });
      validateScores(rubric, input.draft.scores, submit);
      const revision = row.revision ?? 0;
      if (revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      if (row.review_state === "submitted" && !row.editable_after_submit) throw new EntryFault("ENTRY_LOCKED", 409);
      const nextRevision = revision + 1; const at = now(); const state = submit ? "submitted" : "in_progress";
      await db.query(`INSERT INTO gyca_judge_reviews(assignment_id,revision,state,scores,comment,updated_at,submitted_at)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7) ON CONFLICT(assignment_id) DO UPDATE SET revision=EXCLUDED.revision,
        state=EXCLUDED.state,scores=EXCLUDED.scores,comment=EXCLUDED.comment,updated_at=EXCLUDED.updated_at,submitted_at=EXCLUDED.submitted_at`,
        [id, nextRevision, state, JSON.stringify(input.draft.scores), input.draft.comment, at, submit ? at : null]);
      await db.query(`INSERT INTO gyca_judge_review_changes(assignment_id,revision,state,scores,comment,actor_id,created_at)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`, [id, nextRevision, state, JSON.stringify(input.draft.scores), input.draft.comment, judge, at]);
      const pending = (await db.query(`SELECT a.id FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.entry_id=$1 AND v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted' LIMIT 1`, [row.entry_id])).rows.length;
      await db.query("UPDATE gyca_entries SET review_status=$2 WHERE id=$1 AND published_result IS NULL",
        [row.entry_id, pending === 0 ? "completed" : "under_review"]);
      return JudgeReviewMutationSchema.parse({ revision: nextRevision, state, savedAt: at.toISOString(), submittedAt: submit ? at.toISOString() : null });
    });
  }
  async function scheduleBlindJob(db: SqlConnection, assignmentId: string, entryId: string, at: Date) {
    const sources = await db.query(`SELECT id,object_key,object_version FROM gyca_assets
      WHERE entry_id=$1 AND purpose='book_pdf' AND state='ready' AND removed_at IS NULL ORDER BY id`, [entryId]);
    if (sources.rows.length !== 1) throw new EntryFault("FILE_NOT_READY", 409);
    const source = z.object({ id: z.uuid(), object_key: z.string(), object_version: z.string().min(1) }).parse(sources.rows[0]);
    const targetId = randomUUID();
    await db.query(`INSERT INTO gyca_blind_asset_jobs(assignment_id,source_asset_id,source_key,source_version,target_key,state,due_at,created_at)
      VALUES($1,$2,$3,$4,$5,'pending',$6,$6)`, [assignmentId, source.id, source.object_key, source.object_version,
      `quarantine/${entryId}/${targetId}`, at]);
  }
  async function stopBlindJob(db: SqlConnection, assignmentId: string, at: Date) {
    const stopped = await db.query(`UPDATE gyca_blind_asset_jobs SET state='stalled',lease_token=NULL,lease_until=NULL,
      last_error_code='ASSIGNMENT_REVOKED' WHERE assignment_id=$1 AND state IN ('pending','running') RETURNING attempts`, [assignmentId]);
    if (stopped.rows.length) {
      const attempt = z.object({ attempts: z.number().int() }).parse(stopped.rows[0]).attempts;
      await db.query(`INSERT INTO gyca_blind_asset_events VALUES($1,$2,$3,'stalled','ASSIGNMENT_REVOKED',NULL,$4)`,
        [randomUUID(), assignmentId, attempt, at]);
    }
  }
  async function refreshReviewProjection(db: SqlConnection, entryId: string) {
    const raw = (await db.query(`SELECT
      count(a.id) FILTER (WHERE v.assignment_id IS NULL)::integer AS active_count,
      count(a.id) FILTER (WHERE v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted')::integer AS incomplete_count,
      count(r.assignment_id) FILTER (WHERE r.state IN ('in_progress','submitted'))::integer AS started_count
      FROM gyca_judge_assignments a LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
      LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id WHERE a.entry_id=$1`, [entryId])).rows[0];
    const counts = z.object({ active_count: z.number().int(), incomplete_count: z.number().int(), started_count: z.number().int() }).parse(raw);
    const status = counts.active_count > 0 && counts.incomplete_count === 0 ? "completed"
      : counts.started_count > 0 ? "under_review" : "not_started";
    await db.query("UPDATE gyca_entries SET review_status=$2 WHERE id=$1 AND published_result IS NULL AND review_status IS DISTINCT FROM $2", [entryId, status]);
  }
  async function changeReplay(db: SqlConnection, actor: string, actionId: string, requestHash: string, judgeId?: string) {
    const raw = (await db.query(`SELECT x.request_hash,x.revoked_assignment_id,x.replacement_assignment_id,v.created_at
      FROM gyca_judge_assignment_change_actions x JOIN gyca_judge_assignment_revocations v ON v.assignment_id=x.revoked_assignment_id
      WHERE x.actor_id=$1 AND x.action_id=$2`, [actor, actionId])).rows[0];
    if (!raw) return null;
    const saved = z.object({ request_hash: z.string(), revoked_assignment_id: z.uuid(), replacement_assignment_id: z.uuid().nullable(),
      created_at: z.date() }).parse(raw);
    if (saved.request_hash !== requestHash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
    let replacement = null;
    if (saved.replacement_assignment_id && judgeId) replacement = assignmentDto(await assigned(db, judgeId, saved.replacement_assignment_id));
    return JudgeAssignmentChangeSchema.parse({ revokedAssignmentId: saved.revoked_assignment_id, replacement,
      changedAt: saved.created_at.toISOString() });
  }
  return {
    listAdminAssignments: (actor: string, competition: string, rawQuery: unknown) => database.transaction(async db => {
      await admin(db, actor); const query = ListJudgeAssignmentsQuerySchema.parse(rawQuery);
      const competitionRaw = (await db.query("SELECT phase FROM gyca_competitions WHERE id=$1", [competition])).rows[0];
      if (!competitionRaw) throw new EntryFault("NOT_FOUND", 404);
      const phase = z.object({ phase: z.enum(["scheduled", "judging", "result", "archived"]) }).parse(competitionRaw).phase;
      if (query.cursor && !(await db.query("SELECT id FROM gyca_judge_assignments WHERE id=$1 AND competition_id=$2", [query.cursor, competition])).rows.length)
        throw new EntryFault("VALIDATION_FAILED", 422);
      const rows = await db.query(`SELECT a.id,a.entry_id,e.receipt_number,a.blind_code,a.rubric_version,a.created_at,
        j.user_id,j.active,u.name,u.email,COALESCE(r.state,'not_started') AS review_state,COALESCE(r.revision,0) AS review_revision,
        b.state AS blind_asset_state,v.created_at AS revoked_at,v.reason AS revocation_reason,v.replacement_assignment_id
        FROM gyca_judge_assignments a JOIN gyca_entries e ON e.id=a.entry_id JOIN gyca_judges j ON j.user_id=a.judge_id
        JOIN "user" u ON u.id=a.judge_id JOIN gyca_blind_asset_jobs b ON b.assignment_id=a.id
        LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.competition_id=$1 AND ($2::uuid IS NULL OR (a.created_at,a.id)>(SELECT created_at,id FROM gyca_judge_assignments WHERE id=$2))
        ORDER BY a.created_at,a.id LIMIT $3`, [competition, query.cursor, query.limit + 1]);
      const hasMore = rows.rows.length > query.limit; const selected = rows.rows.slice(0, query.limit);
      const items = selected.map(raw => {
        const row = z.object({ id: z.uuid(), entry_id: z.uuid(), receipt_number: z.string(), blind_code: z.string(), rubric_version: z.string(),
          created_at: z.date(), user_id: z.string(), active: z.boolean(), name: z.string(), email: z.string(),
          review_state: z.enum(["not_started", "in_progress", "submitted"]), review_revision: z.number().int(),
          blind_asset_state: z.enum(["pending", "running", "pending_review", "approved", "stalled"]), revoked_at: z.date().nullable(),
          revocation_reason: z.string().nullable(), replacement_assignment_id: z.string().nullable() }).parse(raw);
        const mutable = phase !== "result" && phase !== "archived" && row.revoked_at === null && row.review_state !== "submitted";
        const allowedActions = !mutable ? [] : row.review_state === "not_started"
          ? ["revoke_assignment", "reassign_assignment"] as const : ["reassign_assignment"] as const;
        return AdminJudgeAssignmentSchema.parse({ id: row.id, entryId: row.entry_id, receiptNumber: row.receipt_number, code: row.blind_code,
          judge: { userId: row.user_id, name: row.name, email: row.email, active: row.active }, rubricVersion: row.rubric_version,
          reviewState: row.review_state, reviewRevision: row.review_revision, blindAssetState: row.blind_asset_state,
          createdAt: row.created_at.toISOString(), revokedAt: row.revoked_at?.toISOString() ?? null,
          revocationReason: row.revocation_reason, replacementAssignmentId: row.replacement_assignment_id, allowedActions });
      });
      return AdminJudgeAssignmentsPageSchema.parse({ items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null });
    }),
    revokeAssignment: (actor: string, competition: string, assignmentId: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = RevokeJudgeAssignmentSchema.parse(rawInput); const at = now();
      const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`judge-assignment:${competition}`]);
      const replay = await changeReplay(db, actor, input.actionId, requestHash); if (replay) return replay;
      const raw = (await db.query(`SELECT a.id,COALESCE(r.state,'not_started') AS review_state,COALESCE(r.revision,0) AS review_revision,c.phase,
        v.assignment_id AS revoked FROM gyca_judge_assignments a JOIN gyca_competitions c ON c.id=a.competition_id
        LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.id=$1 AND a.competition_id=$2 FOR UPDATE OF a`, [assignmentId, competition])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ id: z.uuid(), review_state: z.enum(["not_started", "in_progress", "submitted"]), review_revision: z.number().int(),
        phase: z.enum(["scheduled", "judging", "result", "archived"]), revoked: z.uuid().nullable() }).parse(raw);
      if (row.revoked) throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.phase === "result" || row.phase === "archived") throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.review_state !== input.expectedReviewState || row.review_revision !== input.expectedReviewRevision)
        throw new EntryFault("REVISION_CONFLICT", 409);
      await db.query(`INSERT INTO gyca_judge_assignment_revocations
        (assignment_id,previous_review_state,previous_review_revision,reason,actor_id,replacement_assignment_id,created_at)
        VALUES($1,$2,$3,$4,$5,NULL,$6)`, [assignmentId, row.review_state, row.review_revision, input.reason, actor, at]);
      await stopBlindJob(db, assignmentId, at);
      const entryId = z.object({ entry_id: z.uuid() }).parse((await db.query("SELECT entry_id FROM gyca_judge_assignments WHERE id=$1", [assignmentId])).rows[0]).entry_id;
      await refreshReviewProjection(db, entryId);
      await db.query(`INSERT INTO gyca_judge_assignment_change_actions VALUES($1,$2,$3,$4,NULL)`,
        [actor, input.actionId, requestHash, assignmentId]);
      return JudgeAssignmentChangeSchema.parse({ revokedAssignmentId: assignmentId, replacement: null, changedAt: at.toISOString() });
    }),
    reassignAssignment: (actor: string, competition: string, assignmentId: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = ReassignJudgeAssignmentSchema.parse(rawInput); const at = now();
      const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`judge-assignment:${competition}`]);
      const replay = await changeReplay(db, actor, input.actionId, requestHash, input.judgeId); if (replay) return replay;
      const raw = (await db.query(`SELECT a.id,a.entry_id,a.judge_id,a.rubric_version,a.editable_after_submit,e.owner_id,
        COALESCE(r.state,'not_started') AS review_state,COALESCE(r.revision,0) AS review_revision,c.phase,v.assignment_id AS revoked
        FROM gyca_judge_assignments a JOIN gyca_entries e ON e.id=a.entry_id JOIN gyca_competitions c ON c.id=a.competition_id
        LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.id=$1 AND a.competition_id=$2 FOR UPDATE OF a`, [assignmentId, competition])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ id: z.uuid(), entry_id: z.uuid(), judge_id: z.string(), rubric_version: z.string(), editable_after_submit: z.boolean(),
        owner_id: z.string(), review_state: z.enum(["not_started", "in_progress", "submitted"]), review_revision: z.number().int(),
        phase: z.enum(["scheduled", "judging", "result", "archived"]), revoked: z.uuid().nullable() }).parse(raw);
      if (row.revoked || row.phase === "result" || row.phase === "archived") throw new EntryFault("ENTRY_LOCKED", 409);
      if (row.review_state !== input.expectedReviewState || row.review_revision !== input.expectedReviewRevision)
        throw new EntryFault("REVISION_CONFLICT", 409);
      if (input.judgeId === row.judge_id || input.judgeId === row.owner_id) throw new EntryFault("FORBIDDEN", 403);
      if (!(await db.query("SELECT user_id FROM gyca_judges WHERE user_id=$1 AND active=true FOR SHARE", [input.judgeId])).rows.length)
        throw new EntryFault("NOT_FOUND", 404);
      if ((await db.query(`SELECT id FROM gyca_judge_assignments WHERE (entry_id=$1 AND judge_id=$2)
        OR (competition_id=$3 AND blind_code=$4) LIMIT 1`, [row.entry_id, input.judgeId, competition, input.blindCode])).rows.length)
        throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
      const replacementId = randomUUID();
      await db.query(`INSERT INTO gyca_judge_assignments(id,competition_id,entry_id,judge_id,blind_code,rubric_version,editable_after_submit,created_by,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [replacementId, competition, row.entry_id, input.judgeId, input.blindCode,
        row.rubric_version, row.editable_after_submit, actor, at]);
      await scheduleBlindJob(db, replacementId, row.entry_id, at);
      await db.query(`INSERT INTO gyca_judge_assignment_revocations
        (assignment_id,previous_review_state,previous_review_revision,reason,actor_id,replacement_assignment_id,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [assignmentId, row.review_state, row.review_revision, input.reason, actor, replacementId, at]);
      await stopBlindJob(db, assignmentId, at);
      await refreshReviewProjection(db, row.entry_id);
      await db.query(`INSERT INTO gyca_judge_assignment_change_actions VALUES($1,$2,$3,$4,$5)`,
        [actor, input.actionId, requestHash, assignmentId, replacementId]);
      return JudgeAssignmentChangeSchema.parse({ revokedAssignmentId: assignmentId,
        replacement: assignmentDto(await assigned(db, input.judgeId, replacementId)), changedAt: at.toISOString() });
    }),
    listJudges: (actor: string) => database.transaction(async db => {
      await admin(db, actor);
      const rows = await db.query(`SELECT u.id AS user_id,u.email,u.name,j.active,j.created_at,
        count(a.id) FILTER (WHERE v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted')::integer AS unfinished_assignments
        FROM gyca_judges j JOIN "user" u ON u.id=j.user_id
        LEFT JOIN gyca_judge_assignments a ON a.judge_id=j.user_id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        GROUP BY u.id,u.email,u.name,j.active,j.created_at ORDER BY u.name,u.id`);
      return JudgeAccountsSchema.parse(rows.rows.map(raw => {
        const row = z.object({ user_id: z.string(), email: z.string(), name: z.string(), active: z.boolean(), created_at: z.date(),
          unfinished_assignments: z.number().int() }).parse(raw);
        return { userId: row.user_id, email: row.email, name: row.name, active: row.active, createdAt: row.created_at.toISOString(),
          unfinishedAssignments: row.unfinished_assignments };
      }));
    }),
    updateJudge: (actor: string, userId: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = UpdateJudgeAccountSchema.parse(rawInput); const at = now();
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`judge-access:${userId}`]);
      const userRaw = (await db.query('SELECT id,email,name FROM "user" WHERE id=$1 FOR SHARE', [userId])).rows[0];
      if (!userRaw) throw new EntryFault("NOT_FOUND", 404);
      const user = z.object({ id: z.string(), email: z.string(), name: z.string() }).parse(userRaw);
      const currentRaw = (await db.query("SELECT active,created_at FROM gyca_judges WHERE user_id=$1 FOR UPDATE", [userId])).rows[0];
      const current = currentRaw ? z.object({ active: z.boolean(), created_at: z.date() }).parse(currentRaw) : null;
      if ((current?.active ?? null) !== input.expectedActive) throw new EntryFault("REVISION_CONFLICT", 409);
      if (!input.active && !current) throw new EntryFault("NOT_FOUND", 404);
      const countRaw = (await db.query(`SELECT count(*) AS count FROM gyca_judge_assignments a
        LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE a.judge_id=$1 AND v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted'`, [userId])).rows[0];
      const unfinished = countRaw ? Number(z.object({ count: z.union([z.string(), z.number()]) }).parse(countRaw).count) : 0;
      if (!input.active && unfinished > 0) throw new EntryFault("ENTRY_LOCKED", 409);
      const createdAt = current?.created_at ?? at;
      await db.query(`INSERT INTO gyca_judges(user_id,active,created_at) VALUES($1,$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET active=EXCLUDED.active`, [userId, input.active, createdAt]);
      await db.query(`INSERT INTO gyca_judge_access_changes(id,user_id,active,actor_id,reason,created_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [randomUUID(), userId, input.active, actor, input.reason, at]);
      return JudgeAccountSchema.parse({ userId, email: user.email, name: user.name, active: input.active,
        createdAt: createdAt.toISOString(), unfinishedAssignments: unfinished });
    }),
    getBlindAsset: async (actor: string, competition: string, assignmentId: string) => {
      const raw = await database.transaction(async db => { await admin(db, actor); return (await db.query(`SELECT j.assignment_id,j.state,j.attempts,j.last_error_code,
        j.target_key,j.candidate_version,j.candidate_checksum,j.page_count,j.approved_at
        FROM gyca_blind_asset_jobs j JOIN gyca_judge_assignments a ON a.id=j.assignment_id
        WHERE j.assignment_id=$1 AND a.competition_id=$2`, [assignmentId, competition])).rows[0]; });
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ assignment_id: z.uuid(), state: z.enum(["pending", "running", "pending_review", "approved", "stalled"]), attempts: z.number().int(),
        last_error_code: z.string().nullable(), target_key: z.string(), candidate_version: z.string().nullable(), candidate_checksum: z.string().nullable(),
        page_count: z.number().int().nullable(), approved_at: z.date().nullable() }).parse(raw);
      let candidate = null;
      if (row.candidate_version && row.candidate_checksum && row.page_count) {
        if (!storage?.signDownload) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        candidate = { version: row.candidate_version, checksum: row.candidate_checksum, pageCount: row.page_count,
          ...await storage.signDownload({ key: row.target_key, version: row.candidate_version }) };
      }
      return BlindAssetAdminSchema.parse({ assignmentId: row.assignment_id, state: row.state, attempts: row.attempts,
        lastErrorCode: row.last_error_code, candidate, approvedAt: row.approved_at?.toISOString() ?? null });
    },
    approveBlindAsset: (actor: string, competition: string, assignmentId: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = ApproveBlindAssetSchema.parse(rawInput); const at = now();
      const raw = (await db.query(`SELECT j.*,a.competition_id FROM gyca_blind_asset_jobs j
        JOIN gyca_judge_assignments a ON a.id=j.assignment_id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
        WHERE j.assignment_id=$1 AND a.competition_id=$2 AND v.assignment_id IS NULL FOR UPDATE OF j`,
        [assignmentId, competition])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = z.object({ assignment_id: z.uuid(), source_asset_id: z.uuid(), target_key: z.string(), state: z.string(),
        candidate_version: z.string().nullable(), candidate_checksum: z.string().nullable() }).parse(raw);
      if (row.state !== "pending_review" || row.candidate_version !== input.candidateVersion || row.candidate_checksum !== input.candidateChecksum)
        throw new EntryFault("REVISION_CONFLICT", 409);
      await db.query(`INSERT INTO gyca_blind_asset_approvals VALUES($1,$2,$3,$4,$5,$6,$7)`, [assignmentId, input.candidateVersion,
        input.candidateChecksum, true, input.note, actor, at]);
      await db.query(`INSERT INTO gyca_blinded_review_assets(assignment_id,source_asset_id,object_key,object_version,checksum,verified_at)
        VALUES($1,$2,$3,$4,$5,$6)`, [assignmentId, row.source_asset_id, row.target_key, input.candidateVersion, input.candidateChecksum, at]);
      await db.query(`UPDATE gyca_blind_asset_jobs SET state='approved',approved_at=$2 WHERE assignment_id=$1`, [assignmentId, at]);
      await db.query(`INSERT INTO gyca_blind_asset_events VALUES($1,$2,0,'approved',NULL,$3,$4)`, [randomUUID(), assignmentId, actor, at]);
      return { assignmentId, state: "approved" as const, approvedAt: at.toISOString() };
    }),
    getRubric: (actor: string, competition: string) => database.transaction(async db => {
      await admin(db, actor);
      const comp = (await db.query("SELECT revision FROM gyca_competitions WHERE id=$1", [competition])).rows[0];
      if (!comp) throw new EntryFault("NOT_FOUND", 404);
      const revision = z.object({ revision: z.number().int().positive() }).parse(comp).revision;
      const raw = (await db.query("SELECT * FROM gyca_review_rubrics WHERE competition_id=$1", [competition])).rows[0];
      const rubric = raw ? rubricRow.parse(raw) : null;
      return ReviewRubricDetailSchema.parse({ competitionId: competition, competitionRevision: revision,
        rubric: rubric && { version: rubric.version, criteria: rubric.criteria, editableAfterSubmit: rubric.editable_after_submit } });
    }),
    updateRubric: (actor: string, competition: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = UpdateReviewRubricSchema.parse(rawInput); const at = now();
      const raw = (await db.query("SELECT revision,phase FROM gyca_competitions WHERE id=$1 FOR UPDATE", [competition])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const comp = z.object({ revision: z.number().int(), phase: z.string() }).parse(raw);
      if (comp.revision !== input.competitionRevision) throw new EntryFault("REVISION_CONFLICT", 409);
      if (comp.phase === "result" || comp.phase === "archived" || (await db.query("SELECT id FROM gyca_judge_assignments WHERE competition_id=$1 LIMIT 1", [competition])).rows.length)
        throw new EntryFault("ENTRY_LOCKED", 409);
      const next = comp.revision + 1;
      await db.query(`INSERT INTO gyca_review_rubrics(competition_id,version,criteria,editable_after_submit,configured_by,configured_at)
        VALUES($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT(competition_id) DO UPDATE SET version=EXCLUDED.version,criteria=EXCLUDED.criteria,
        editable_after_submit=EXCLUDED.editable_after_submit,configured_by=EXCLUDED.configured_by,configured_at=EXCLUDED.configured_at`,
        [competition, input.rubric.version, JSON.stringify(input.rubric.criteria), input.rubric.editableAfterSubmit, actor, at]);
      await db.query("UPDATE gyca_competitions SET revision=$2 WHERE id=$1", [competition, next]);
      await db.query(`INSERT INTO gyca_review_rubric_changes VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`,
        [competition, next, input.rubric.version, JSON.stringify(input.rubric.criteria), input.rubric.editableAfterSubmit, actor, at]);
      return ReviewRubricDetailSchema.parse({ competitionId: competition, competitionRevision: next, rubric: input.rubric });
    }),
    assign: (actor: string, competition: string, rawInput: unknown) => database.transaction(async db => {
      await admin(db, actor); const input = CreateJudgeAssignmentSchema.parse(rawInput); const at = now();
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`judge-assignment:${competition}`]);
      const replay = (await db.query("SELECT request_hash,assignment_id FROM gyca_judge_assignment_actions WHERE actor_id=$1 AND action_id=$2", [actor, input.actionId])).rows[0];
      if (replay) {
        const saved = z.object({ request_hash: z.string(), assignment_id: z.uuid() }).parse(replay);
        if (saved.request_hash !== hash) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        const row = await assigned(db, input.judgeId, saved.assignment_id); return assignmentDto(row);
      }
      const rubricRaw = (await db.query("SELECT * FROM gyca_review_rubrics WHERE competition_id=$1 FOR SHARE", [competition])).rows[0];
      if (!rubricRaw) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      const rubric = rubricRow.parse(rubricRaw);
      const competitionRow = (await db.query("SELECT phase FROM gyca_competitions WHERE id=$1 FOR SHARE", [competition])).rows[0];
      if (!competitionRow) throw new EntryFault("NOT_FOUND", 404);
      if (["result", "archived"].includes(z.object({ phase: z.string() }).parse(competitionRow).phase)) throw new EntryFault("ENTRY_LOCKED", 409);
      if (!(await db.query("SELECT user_id FROM gyca_judges WHERE user_id=$1 AND active=true FOR SHARE", [input.judgeId])).rows.length)
        throw new EntryFault("NOT_FOUND", 404);
      const entryRaw = (await db.query("SELECT owner_id,review_status FROM gyca_entries WHERE id=$1 AND competition_id=$2 AND status='received' FOR SHARE", [input.entryId, competition])).rows[0];
      if (!entryRaw)
        throw new EntryFault("NOT_FOUND", 404);
      const entry = z.object({ owner_id: z.string(), review_status: z.string() }).parse(entryRaw);
      if (entry.owner_id === input.judgeId) throw new EntryFault("FORBIDDEN", 403);
      if (entry.review_status === "completed") throw new EntryFault("ENTRY_LOCKED", 409);
      if ((await db.query(`SELECT id FROM gyca_judge_assignments WHERE (entry_id=$1 AND judge_id=$2)
        OR (competition_id=$3 AND blind_code=$4) LIMIT 1`, [input.entryId, input.judgeId, competition, input.blindCode])).rows.length)
        throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
      const id = randomUUID();
      await db.query(`INSERT INTO gyca_judge_assignments(id,competition_id,entry_id,judge_id,blind_code,rubric_version,editable_after_submit,created_by,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, competition, input.entryId, input.judgeId, input.blindCode,
        rubric.version, rubric.editable_after_submit, actor, at]);
      await db.query("INSERT INTO gyca_judge_assignment_actions VALUES($1,$2,$3,$4)", [actor, input.actionId, hash, id]);
      await scheduleBlindJob(db, id, input.entryId, at);
      return assignmentDto(await assigned(db, input.judgeId, id));
    }),
    list: (judge: string) => database.transaction(async db => {
      if (!(await db.query("SELECT user_id FROM gyca_judges WHERE user_id=$1 AND active=true", [judge])).rows.length)
        throw new EntryFault("FORBIDDEN", 403);
      const rows = await db.query(`${assignmentSelect} WHERE a.judge_id=$1 AND v.assignment_id IS NULL ORDER BY a.created_at,a.id`, [judge]);
      return JudgeAssignmentsSchema.parse(rows.rows.map(raw => assignmentDto(assignmentRow.parse(raw))));
    }),
    context: async (judge: string, id: string) => {
      const row = await assigned(database, judge, id); let pdf = null;
      if (row.object_key && row.object_version && !storage?.signDownload) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      if (row.object_key && row.object_version && storage?.signDownload) {
        const signed = await storage.signDownload({ key: row.object_key, version: row.object_version });
        pdf = { blindedName: `${row.blind_code}.pdf`, ...signed };
      }
      return JudgeReviewContextSchema.parse({ assignment: assignmentDto(row), rubric: row.criteria,
        draft: { scores: row.scores ?? {}, comment: row.comment ?? "" }, submitted: row.review_state === "submitted",
        editableAfterSubmit: row.editable_after_submit, revision: row.revision ?? 0, pdf,
        blockingReasons: pdf ? [] : ["BLINDED_FILE_NOT_READY"] });
    },
    save: (judge: string, id: string, input: unknown) => mutate(judge, id, input, false),
    submit: (judge: string, id: string, input: unknown) => mutate(judge, id, input, true),
  };
}
