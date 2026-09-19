import { createHash } from "node:crypto";
import { z } from "zod";
import { AdminFinalParticipationSchema, FinalParticipationMutationSchema, PublishResultRoundRequestSchema, PublishResultsRequestSchema,
  RespondFinalParticipationSchema, ResultPublicationSchema, ResultRoundPublicationSchema, ResultRoundSchema,
  ReviewDecisionDetailSchema, UpdateReviewDecisionSchema } from "../../contracts/result-admin.ts";
import { RetentionPolicySchema } from "../../contracts/retention-policy.ts";
import type { EntryDatabase, SqlConnection } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, jsonBody, parseRequest } from "./http.ts";

const competitionIdSchema = z.string().min(1).max(128);
const reviewRowSchema = z.object({ review_status: z.enum(["not_started", "under_review", "completed"]),
  decision: z.enum(["official_selection", "finalist", "not_selected"]).nullable(), revision: z.number().int().positive(), updated_at: z.date() });

async function authorize(db: SqlConnection, actor: string) {
  if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
    throw new EntryFault("FORBIDDEN", 403);
}

function emptyReview(entryId: string) {
  return ReviewDecisionDetailSchema.parse({ entryId, revision: 0, reviewStatus: "not_started", decision: null, updatedAt: null });
}

export function createResultAdminHandlers(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  const ids = (competitionId: string, entryId: string) => ({
    competition: parseRequest(competitionIdSchema, competitionId), entry: parseRequest(z.uuid(), entryId),
  });
  async function participationAt(db: SqlConnection, entryId: string, revision: number) {
    const raw = (await db.query(`SELECT fp.invitation_published_at,fp.order_id,c.revision,c.state,c.created_at
      FROM gyca_final_participations fp JOIN gyca_final_participation_changes c ON c.entry_id=fp.entry_id
      WHERE fp.entry_id=$1 AND c.revision=$2`, [entryId, revision])).rows[0];
    if (!raw) throw new EntryFault("INTERNAL_ERROR", 500);
    const row = z.object({ invitation_published_at: z.date(), order_id: z.uuid().nullable(), revision: z.number().int(),
      state: z.enum(["invited", "confirmation_pending", "confirmed", "declined"]), created_at: z.date() }).parse(raw);
    return FinalParticipationMutationSchema.parse({ entryId, revision: row.revision, state: row.state,
      invitationPublishedAt: row.invitation_published_at.toISOString(), confirmedAt: row.state === "confirmed" ? row.created_at.toISOString() : null,
      orderId: row.order_id, updatedAt: row.created_at.toISOString() });
  }
  return {
    respondFinalParticipation: (request: Request, entryId: string) => run(request, true, 200, async actor => {
      const entry = parseRequest(z.uuid(), entryId); const input = parseRequest(RespondFinalParticipationSchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
        const replayRaw = (await db.query("SELECT request_hash,entry_id,resulting_revision FROM gyca_final_participation_actions WHERE actor_id=$1 AND action_id=$2",
          [actor, input.actionId])).rows[0];
        if (replayRaw) {
          const replay = z.object({ request_hash: z.string(), entry_id: z.uuid(), resulting_revision: z.number().int() }).parse(replayRaw);
          if (replay.request_hash !== hash || replay.entry_id !== entry) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return participationAt(db, entry, replay.resulting_revision);
        }
        const raw = (await db.query(`SELECT fp.revision,fp.state FROM gyca_final_participations fp
          JOIN gyca_entries e ON e.id=fp.entry_id WHERE fp.entry_id=$1 AND e.owner_id=$2 FOR UPDATE OF fp`, [entry, actor])).rows[0];
        if (!raw) throw new EntryFault("NOT_FOUND", 404);
        const row = z.object({ revision: z.number().int(), state: z.enum(["invited", "confirmation_pending", "confirmed", "declined"]) }).parse(raw);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.state !== "invited") throw new EntryFault("ENTRY_LOCKED", 409);
        const at = deps.now(); const revision = row.revision + 1; const state = input.response === "accept" ? "confirmation_pending" : "declined";
        await db.query("UPDATE gyca_final_participations SET revision=$2,state=$3,confirmed_at=NULL,updated_at=$4 WHERE entry_id=$1",
          [entry, revision, state, at]);
        await db.query(`UPDATE gyca_entries e SET final_participation_revision=fp.revision,
          final_participation_state=fp.state,invitation_published_at=fp.invitation_published_at,
          final_participation_confirmed_at=fp.confirmed_at,final_participation_order_id=fp.order_id
          FROM gyca_final_participations fp WHERE fp.entry_id=e.id AND e.id=$1`, [entry]);
        await db.query(`INSERT INTO gyca_final_participation_changes(entry_id,revision,state,actor_id,reason,created_at)
          VALUES($1,$2,$3,$4,$5,$6)`, [entry, revision, state, actor, `participant_${input.response}`, at]);
        await db.query("INSERT INTO gyca_final_participation_actions VALUES($1,$2,$3,$4,$5)", [actor, input.actionId, hash, entry, revision]);
        return participationAt(db, entry, revision);
      });
    }),
    updateFinalParticipation: (request: Request, competitionId: string, entryId: string) => run(request, true, 200, async actor => {
      const { competition, entry } = ids(competitionId, entryId); const input = parseRequest(AdminFinalParticipationSchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor); const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([actor, input.actionId])]);
        const replayRaw = (await db.query("SELECT request_hash,entry_id,resulting_revision FROM gyca_final_participation_actions WHERE actor_id=$1 AND action_id=$2",
          [actor, input.actionId])).rows[0];
        if (replayRaw) {
          const replay = z.object({ request_hash: z.string(), entry_id: z.uuid(), resulting_revision: z.number().int() }).parse(replayRaw);
          if (replay.request_hash !== hash || replay.entry_id !== entry) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return participationAt(db, entry, replay.resulting_revision);
        }
        const raw = (await db.query(`SELECT fp.revision,fp.state,c.phase FROM gyca_final_participations fp
          JOIN gyca_entries e ON e.id=fp.entry_id JOIN gyca_competitions c ON c.id=e.competition_id
          WHERE fp.entry_id=$1 AND e.competition_id=$2 FOR UPDATE OF fp`, [entry, competition])).rows[0];
        if (!raw) throw new EntryFault("NOT_FOUND", 404);
        const row = z.object({ revision: z.number().int(), state: z.enum(["invited", "confirmation_pending", "confirmed", "declined"]),
          phase: z.enum(["scheduled", "judging", "result", "archived"]) }).parse(raw);
        if (row.phase === "archived" || row.state !== "confirmation_pending") throw new EntryFault("ENTRY_LOCKED", 409);
        if (row.revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        const at = deps.now(); const revision = row.revision + 1;
        await db.query("UPDATE gyca_final_participations SET revision=$2,state=$3,confirmed_at=$4,updated_at=$5 WHERE entry_id=$1",
          [entry, revision, input.state, input.state === "confirmed" ? at : null, at]);
        await db.query(`UPDATE gyca_entries e SET final_participation_revision=fp.revision,
          final_participation_state=fp.state,invitation_published_at=fp.invitation_published_at,
          final_participation_confirmed_at=fp.confirmed_at,final_participation_order_id=fp.order_id
          FROM gyca_final_participations fp WHERE fp.entry_id=e.id AND e.id=$1`, [entry]);
        await db.query(`INSERT INTO gyca_final_participation_changes(entry_id,revision,state,actor_id,reason,created_at)
          VALUES($1,$2,$3,$4,$5,$6)`, [entry, revision, input.state, actor, input.reason, at]);
        await db.query("INSERT INTO gyca_final_participation_actions VALUES($1,$2,$3,$4,$5)", [actor, input.actionId, hash, entry, revision]);
        return participationAt(db, entry, revision);
      });
    }),
    getReview: (request: Request, competitionId: string, entryId: string) => run(request, false, 200, actor => deps.database.transaction(async db => {
      const { competition, entry } = ids(competitionId, entryId); await authorize(db, actor);
      const owned = await db.query("SELECT id FROM gyca_entries WHERE id=$1 AND competition_id=$2 AND status='received'", [entry, competition]);
      if (!owned.rows.length) throw new EntryFault("NOT_FOUND", 404);
      const raw = (await db.query("SELECT * FROM gyca_entry_reviews WHERE entry_id=$1", [entry])).rows[0];
      if (!raw) return emptyReview(entry);
      const row = reviewRowSchema.parse(raw);
      return ReviewDecisionDetailSchema.parse({ entryId: entry, revision: row.revision, reviewStatus: row.review_status,
        decision: row.decision, updatedAt: row.updated_at.toISOString() });
    })),
    updateReview: (request: Request, competitionId: string, entryId: string) => run(request, true, 200, async actor => {
      const { competition, entry } = ids(competitionId, entryId);
      const input = parseRequest(UpdateReviewDecisionSchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor); const at = deps.now();
        const competitionRow = (await db.query("SELECT phase,closes_at FROM gyca_competitions WHERE id=$1 FOR SHARE", [competition])).rows[0];
        if (!competitionRow) throw new EntryFault("NOT_FOUND", 404);
        const state = z.object({ phase: z.enum(["scheduled", "judging", "result", "archived"]), closes_at: z.date().nullable() }).parse(competitionRow);
        const rounds = await db.query("SELECT round FROM gyca_result_round_publication_batches WHERE competition_id=$1", [competition]);
        const publishedRounds = new Set(rounds.rows.map(raw => z.object({ round: ResultRoundSchema }).parse(raw).round));
        if (state.phase === "archived" || publishedRounds.has("finalist")) throw new EntryFault("ENTRY_LOCKED", 409);
        if (!state.closes_at || at < state.closes_at) throw new EntryFault("ENTRY_LOCKED", 409);
        const entryRaw = (await db.query("SELECT id,published_result FROM gyca_entries WHERE id=$1 AND competition_id=$2 AND status='received' FOR UPDATE", [entry, competition])).rows[0];
        if (!entryRaw)
          throw new EntryFault("NOT_FOUND", 404);
        const entryState = z.object({ id: z.uuid(), published_result: z.enum(["official_selection", "finalist", "not_selected"]).nullable() }).parse(entryRaw);
        if (state.phase === "result" && (!publishedRounds.has("official_selection") || entryState.published_result !== "official_selection"
          || input.reviewStatus !== "completed" || !["official_selection", "finalist"].includes(input.decision ?? "")))
          throw new EntryFault("ENTRY_LOCKED", 409);
        const currentRaw = (await db.query("SELECT * FROM gyca_entry_reviews WHERE entry_id=$1 FOR UPDATE", [entry])).rows[0];
        const currentRevision = currentRaw ? reviewRowSchema.parse(currentRaw).revision : 0;
        if (currentRevision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (input.reviewStatus === "completed" && (await db.query(`SELECT a.id FROM gyca_judge_assignments a
          LEFT JOIN gyca_judge_reviews r ON r.assignment_id=a.id
          LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id
          WHERE a.entry_id=$1 AND v.assignment_id IS NULL AND r.state IS DISTINCT FROM 'submitted' LIMIT 1`, [entry])).rows.length)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const revision = currentRevision + 1;
        await db.query(`INSERT INTO gyca_entry_reviews(entry_id,review_status,decision,revision,updated_by,updated_at)
          VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(entry_id) DO UPDATE SET review_status=EXCLUDED.review_status,
          decision=EXCLUDED.decision,revision=EXCLUDED.revision,updated_by=EXCLUDED.updated_by,updated_at=EXCLUDED.updated_at`,
          [entry, input.reviewStatus, input.decision, revision, actor, at]);
        await db.query(`INSERT INTO gyca_entry_review_changes(entry_id,revision,actor_id,review_status,decision,created_at)
          VALUES($1,$2,$3,$4,$5,$6)`, [entry, revision, actor, input.reviewStatus, input.decision, at]);
        await db.query("UPDATE gyca_entries SET review_status=$2 WHERE id=$1", [entry, input.reviewStatus]);
        return ReviewDecisionDetailSchema.parse({ entryId: entry, revision, reviewStatus: input.reviewStatus,
          decision: input.decision, updatedAt: at.toISOString() });
      });
    }),
    publish: (request: Request, competitionId: string) => run(request, true, 200, async actor => {
      const competition = parseRequest(competitionIdSchema, competitionId);
      const input = parseRequest(PublishResultsRequestSchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor); const at = deps.now();
        const raw = (await db.query("SELECT revision,phase,closes_at,payment_closes_at,retention_policy FROM gyca_competitions WHERE id=$1 FOR UPDATE", [competition])).rows[0];
        if (!raw) throw new EntryFault("NOT_FOUND", 404);
        const existingRaw = (await db.query("SELECT * FROM gyca_result_publication_batches WHERE competition_id=$1", [competition])).rows[0];
        if (existingRaw) {
          const existing = z.object({ source_revision: z.number(), resulting_revision: z.number(), entry_count: z.number(), published_at: z.date() }).parse(existingRaw);
          if (existing.source_revision !== input.competitionRevision) throw new EntryFault("REVISION_CONFLICT", 409);
          return ResultPublicationSchema.parse({ competitionId: competition, sourceRevision: existing.source_revision,
            resultingRevision: existing.resulting_revision, entryCount: existing.entry_count, publishedAt: existing.published_at.toISOString() });
        }
        const row = z.object({ revision: z.number().int().positive(), phase: z.enum(["scheduled", "judging", "result", "archived"]),
          closes_at: z.date().nullable(), payment_closes_at: z.date().nullable(), retention_policy: z.unknown().nullable() }).parse(raw);
        if (row.revision !== input.competitionRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.phase === "result" || row.phase === "archived") throw new EntryFault("ENTRY_LOCKED", 409);
        if (!row.closes_at || at < row.closes_at || (row.payment_closes_at !== null && at < row.payment_closes_at))
          throw new EntryFault("ENTRY_LOCKED", 409);
        const policy = RetentionPolicySchema.safeParse(row.retention_policy);
        if (!policy.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        if ((await db.query("SELECT id FROM gyca_entries WHERE competition_id=$1 AND status='submitted' LIMIT 1", [competition])).rows.length)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const counts = z.object({ total: z.coerce.number().int(), incomplete: z.coerce.number().int() }).parse((await db.query(`SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE r.review_status IS DISTINCT FROM 'completed' OR r.decision IS NULL) AS incomplete
          FROM gyca_entries e LEFT JOIN gyca_entry_reviews r ON r.entry_id=e.id
          WHERE e.competition_id=$1 AND e.status='received'`, [competition])).rows[0]);
        if (counts.total < 1 || counts.incomplete > 0) throw new EntryFault("ENTRY_LOCKED", 409);
        const resultingRevision = row.revision + 1;
        await db.query("UPDATE gyca_competitions SET phase='result',revision=$2 WHERE id=$1", [competition, resultingRevision]);
        await db.query(`INSERT INTO gyca_result_publication_batches
          (competition_id,source_revision,resulting_revision,entry_count,actor_id,published_at) VALUES($1,$2,$3,$4,$5,$6)`,
          [competition, row.revision, resultingRevision, counts.total, actor, at]);
        await db.query(`INSERT INTO gyca_entry_result_publications(entry_id,competition_id,result,review_revision,actor_id,published_at)
          SELECT e.id,e.competition_id,r.decision,r.revision,$2,$3 FROM gyca_entries e JOIN gyca_entry_reviews r ON r.entry_id=e.id
          WHERE e.competition_id=$1 AND e.status='received'`, [competition, actor, at]);
        await db.query(`UPDATE gyca_entries e SET published_result=p.result FROM gyca_entry_result_publications p
          WHERE p.entry_id=e.id AND p.competition_id=$1`, [competition]);
        const unselectedDue = new Date(at.getTime() + policy.data.unselectedSubmissionAssets.deleteAfterDays * 86400000);
        const selectedDue = new Date(at.getTime() + policy.data.selectedSubmissionAssets.deleteAfterDays * 86400000);
        await db.query(`INSERT INTO gyca_asset_deletion_jobs
          (asset_id,entry_id,competition_id,object_key,object_version,reason,policy_version,due_at,created_at)
          SELECT a.id,a.entry_id,e.competition_id,a.object_key,a.object_version,
            CASE WHEN p.result='not_selected' THEN 'unselected_submission' ELSE 'selected_submission' END,$2,
            CASE WHEN p.result='not_selected' THEN $3::timestamptz ELSE $4::timestamptz END,$5
          FROM gyca_assets a JOIN gyca_entries e ON e.id=a.entry_id
          JOIN gyca_entry_result_publications p ON p.entry_id=e.id
          WHERE e.competition_id=$1 AND a.object_version IS NOT NULL AND a.object_version<>'null' AND a.removed_at IS NULL
          ON CONFLICT DO NOTHING`, [competition, policy.data.version, unselectedDue, selectedDue, at]);
        return ResultPublicationSchema.parse({ competitionId: competition, sourceRevision: row.revision,
          resultingRevision, entryCount: counts.total, publishedAt: at.toISOString() });
      });
    }),
    publishRound: (request: Request, competitionId: string, rawRound: string) => run(request, true, 200, async actor => {
      const competition = parseRequest(competitionIdSchema, competitionId); const round = parseRequest(ResultRoundSchema, rawRound);
      const input = parseRequest(PublishResultRoundRequestSchema, await jsonBody(request));
      return deps.database.transaction(async db => {
        await authorize(db, actor); const at = deps.now();
        const raw = (await db.query("SELECT revision,phase,closes_at,payment_closes_at,retention_policy FROM gyca_competitions WHERE id=$1 FOR UPDATE", [competition])).rows[0];
        if (!raw) throw new EntryFault("NOT_FOUND", 404);
        const existingRaw = (await db.query("SELECT * FROM gyca_result_round_publication_batches WHERE competition_id=$1 AND round=$2", [competition, round])).rows[0];
        if (existingRaw) {
          const existing = z.object({ source_revision: z.number(), resulting_revision: z.number(), eligible_count: z.number(), selected_count: z.number(),
            published_at: z.date() }).parse(existingRaw);
          if (existing.source_revision !== input.competitionRevision) throw new EntryFault("REVISION_CONFLICT", 409);
          return ResultRoundPublicationSchema.parse({ competitionId: competition, round, sourceRevision: existing.source_revision,
            resultingRevision: existing.resulting_revision, eligibleCount: existing.eligible_count, selectedCount: existing.selected_count,
            publishedAt: existing.published_at.toISOString() });
        }
        const state = z.object({ revision: z.number().int().positive(), phase: z.enum(["scheduled", "judging", "result", "archived"]),
          closes_at: z.date().nullable(), payment_closes_at: z.date().nullable(), retention_policy: z.unknown().nullable() }).parse(raw);
        if (state.revision !== input.competitionRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        if (state.phase === "archived" || !state.closes_at || at < state.closes_at
          || (state.payment_closes_at !== null && at < state.payment_closes_at)) throw new EntryFault("ENTRY_LOCKED", 409);
        const policy = RetentionPolicySchema.safeParse(state.retention_policy);
        if (!policy.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        if ((await db.query("SELECT id FROM gyca_entries WHERE competition_id=$1 AND status='submitted' LIMIT 1", [competition])).rows.length)
          throw new EntryFault("ENTRY_LOCKED", 409);
        const priorOfficial = (await db.query("SELECT competition_id FROM gyca_result_round_publication_batches WHERE competition_id=$1 AND round='official_selection'", [competition])).rows.length > 0;
        if ((round === "official_selection" && (state.phase === "result" || priorOfficial))
          || (round === "finalist" && (state.phase !== "result" || !priorOfficial))) throw new EntryFault("ENTRY_LOCKED", 409);
        const counts = round === "official_selection"
          ? z.object({ eligible: z.coerce.number().int(), incomplete: z.coerce.number().int(), selected: z.coerce.number().int() }).parse((await db.query(`SELECT
              count(*) AS eligible,count(*) FILTER (WHERE r.review_status IS DISTINCT FROM 'completed' OR r.decision IS NULL) AS incomplete,
              count(*) FILTER (WHERE r.decision IN ('official_selection','finalist')) AS selected
            FROM gyca_entries e LEFT JOIN gyca_entry_reviews r ON r.entry_id=e.id WHERE e.competition_id=$1 AND e.status='received'`, [competition])).rows[0])
          : z.object({ eligible: z.coerce.number().int(), incomplete: z.coerce.number().int(), selected: z.coerce.number().int() }).parse((await db.query(`SELECT
              count(*) AS eligible,count(*) FILTER (WHERE r.review_status IS DISTINCT FROM 'completed' OR r.decision NOT IN ('official_selection','finalist')) AS incomplete,
              count(*) FILTER (WHERE r.decision='finalist') AS selected
            FROM gyca_entries e JOIN gyca_entry_reviews r ON r.entry_id=e.id
            WHERE e.competition_id=$1 AND e.status='received' AND e.published_result='official_selection'`, [competition])).rows[0]);
        if (counts.eligible < 1 || counts.incomplete > 0) throw new EntryFault("ENTRY_LOCKED", 409);
        const resultingRevision = state.revision + 1;
        await db.query(`INSERT INTO gyca_result_round_publication_batches
          (competition_id,round,source_revision,resulting_revision,eligible_count,selected_count,actor_id,published_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [competition, round, state.revision, resultingRevision, counts.eligible, counts.selected, actor, at]);
        if (round === "official_selection") {
          await db.query(`INSERT INTO gyca_entry_result_round_publications
            (competition_id,round,entry_id,result,review_revision,actor_id,published_at)
            SELECT e.competition_id,$2,e.id,CASE WHEN r.decision='not_selected' THEN 'not_selected' ELSE 'official_selection' END,
              r.revision,$3,$4 FROM gyca_entries e JOIN gyca_entry_reviews r ON r.entry_id=e.id
            WHERE e.competition_id=$1 AND e.status='received'`, [competition, round, actor, at]);
        } else {
          await db.query(`INSERT INTO gyca_entry_result_round_publications
            (competition_id,round,entry_id,result,review_revision,actor_id,published_at)
            SELECT e.competition_id,$2,e.id,CASE WHEN r.decision='finalist' THEN 'finalist' ELSE 'official_selection' END,
              r.revision,$3,$4 FROM gyca_entries e JOIN gyca_entry_reviews r ON r.entry_id=e.id
            WHERE e.competition_id=$1 AND e.status='received' AND e.published_result='official_selection'`, [competition, round, actor, at]);
        }
        await db.query(`UPDATE gyca_entries e SET published_result=p.result FROM gyca_entry_result_round_publications p
          WHERE p.entry_id=e.id AND p.competition_id=$1 AND p.round=$2`, [competition, round]);
        if (round === "finalist") {
          await db.query(`INSERT INTO gyca_final_participations(entry_id,revision,state,invitation_published_at,confirmed_at,order_id,updated_at)
            SELECT p.entry_id,1,'invited',$2,NULL,NULL,$2 FROM gyca_entry_result_round_publications p
            WHERE p.competition_id=$1 AND p.round='finalist' AND p.result='finalist'`, [competition, at]);
          await db.query(`INSERT INTO gyca_final_participation_changes(entry_id,revision,state,actor_id,reason,created_at)
            SELECT entry_id,1,'invited',$2,'finalist_result_published',$3 FROM gyca_final_participations fp
            JOIN gyca_entries e ON e.id=fp.entry_id WHERE e.competition_id=$1`, [competition, actor, at]);
          await db.query(`UPDATE gyca_entries e SET final_participation_revision=fp.revision,
            final_participation_state=fp.state,invitation_published_at=fp.invitation_published_at,
            final_participation_confirmed_at=fp.confirmed_at,final_participation_order_id=fp.order_id
            FROM gyca_final_participations fp WHERE fp.entry_id=e.id AND e.competition_id=$1`, [competition]);
        }
        const reason = round === "official_selection" ? "unselected_submission" : "selected_submission";
        const due = new Date(at.getTime() + (round === "official_selection"
          ? policy.data.unselectedSubmissionAssets.deleteAfterDays : policy.data.selectedSubmissionAssets.deleteAfterDays) * 86400000);
        await db.query(`INSERT INTO gyca_asset_deletion_jobs
          (asset_id,entry_id,competition_id,object_key,object_version,reason,policy_version,due_at,created_at)
          SELECT a.id,a.entry_id,e.competition_id,a.object_key,a.object_version,$2,$3,$4,$5 FROM gyca_assets a
          JOIN gyca_entries e ON e.id=a.entry_id WHERE e.competition_id=$1 AND a.object_version IS NOT NULL AND a.object_version<>'null'
            AND a.removed_at IS NULL AND (($2='unselected_submission' AND e.published_result='not_selected')
              OR ($2='selected_submission' AND e.published_result IN ('official_selection','finalist'))) ON CONFLICT DO NOTHING`,
          [competition, reason, policy.data.version, due, at]);
        await db.query("UPDATE gyca_competitions SET phase='result',revision=$2 WHERE id=$1", [competition, resultingRevision]);
        return ResultRoundPublicationSchema.parse({ competitionId: competition, round, sourceRevision: state.revision,
          resultingRevision, eligibleCount: counts.eligible, selectedCount: counts.selected, publishedAt: at.toISOString() });
      });
    }),
  };
}
