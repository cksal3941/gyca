import { z } from "zod";
import { LaunchVerificationSchema, OpenedApplicationsSchema,
  type OpenApplications, type RecordLaunchVerification } from "../../contracts/launch-control.ts";
import type { LaunchReadiness } from "../../contracts/launch-readiness.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";

const editor = async (db: { query: EntryDatabase["query"] }, actor: string) => {
  if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
    throw new EntryFault("FORBIDDEN", 403);
};
const verificationRow = z.object({ id: z.uuid(), competition_id: z.string(), competition_revision: z.number().int().positive(),
  code: z.enum(["storage", "retention", "live_payment_verification"]), actor_id: z.string(), evidence_reference: z.string(),
  verified_at: z.coerce.date(), valid_until: z.coerce.date() });
const openRow = z.object({ action_id: z.uuid(), competition_id: z.string(), previous_revision: z.number().int().positive(),
  resulting_revision: z.number().int().positive(), actor_id: z.string(), reason: z.string(), created_at: z.coerce.date() });
function presentVerification(row: z.infer<typeof verificationRow>) {
  return LaunchVerificationSchema.parse({ id: row.id, competitionId: row.competition_id,
    competitionRevision: row.competition_revision, code: row.code, evidenceReference: row.evidence_reference,
    verifiedAt: row.verified_at.toISOString(), validUntil: row.valid_until.toISOString() });
}

export function createLaunchControl(database: EntryDatabase, now: () => Date,
  assess: (actor: string, competitionId: string) => Promise<LaunchReadiness>) {
  return {
    recordVerification: (actor: string, competitionId: string, input: RecordLaunchVerification) =>
      database.transaction(async db => {
        await editor(db, actor);
        const competition = (await db.query("SELECT revision FROM gyca_competitions WHERE id=$1 FOR SHARE", [competitionId])).rows[0];
        if (competition === undefined) throw new EntryFault("NOT_FOUND", 404);
        const revision = z.object({ revision: z.number().int().positive() }).parse(competition).revision;
        const priorRaw = (await db.query("SELECT * FROM gyca_launch_verifications WHERE id=$1", [input.actionId])).rows[0];
        if (priorRaw !== undefined) {
          const prior = verificationRow.parse(priorRaw);
          if (prior.actor_id !== actor || prior.competition_id !== competitionId || prior.competition_revision !== input.expectedRevision
            || prior.code !== input.code || prior.evidence_reference !== input.evidenceReference
            || prior.valid_until.getTime() !== Date.parse(input.validUntil)) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return presentVerification(prior);
        }
        if (revision !== input.expectedRevision) throw new EntryFault("REVISION_CONFLICT", 409);
        const at = now(); const until = new Date(input.validUntil);
        if (until.getTime() < at.getTime() + 300000 || until.getTime() > at.getTime() + 30 * 86400000)
          throw new EntryFault("VALIDATION_FAILED", 422);
        const saved = verificationRow.parse((await db.query(`INSERT INTO gyca_launch_verifications
          (id,competition_id,competition_revision,code,actor_id,evidence_reference,verified_at,valid_until)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [input.actionId, competitionId, revision, input.code, actor,
          input.evidenceReference, at, until])).rows[0]);
        return presentVerification(saved);
      }),
    open: async (actor: string, competitionId: string, input: OpenApplications) => {
      const replay = await database.transaction(async db => {
        await editor(db, actor);
        const raw = (await db.query("SELECT * FROM gyca_application_opens WHERE action_id=$1", [input.actionId])).rows[0];
        if (raw === undefined) return null;
        const saved = openRow.parse(raw);
        if (saved.actor_id !== actor || saved.competition_id !== competitionId || saved.previous_revision !== input.expectedRevision
          || saved.reason !== input.reason) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return OpenedApplicationsSchema.parse({ actionId: saved.action_id, competitionId, revision: saved.resulting_revision,
          draftEnabled: true, paymentEnabled: true, openedAt: saved.created_at.toISOString() });
      });
      if (replay !== null) return replay;
      const readiness = await assess(actor, competitionId);
      if (!readiness.canOpen || !readiness.allowedActions.includes("open_applications")) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
      return database.transaction(async db => {
        await editor(db, actor);
        const priorRaw = (await db.query("SELECT * FROM gyca_application_opens WHERE action_id=$1", [input.actionId])).rows[0];
        if (priorRaw !== undefined) {
          const prior = openRow.parse(priorRaw);
          if (prior.actor_id !== actor || prior.competition_id !== competitionId || prior.previous_revision !== input.expectedRevision
            || prior.reason !== input.reason) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
          return OpenedApplicationsSchema.parse({ actionId: prior.action_id, competitionId, revision: prior.resulting_revision,
            draftEnabled: true, paymentEnabled: true, openedAt: prior.created_at.toISOString() });
        }
        const raw = (await db.query(`SELECT revision,draft_enabled,payment_enabled,closes_at FROM gyca_competitions
          WHERE id=$1 FOR UPDATE`, [competitionId])).rows[0];
        if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
        const row = z.object({ revision: z.number().int().positive(), draft_enabled: z.boolean(), payment_enabled: z.boolean(),
          closes_at: z.coerce.date().nullable() }).parse(raw);
        if (row.revision !== input.expectedRevision || readiness.revision !== row.revision)
          throw new EntryFault("REVISION_CONFLICT", 409);
        if (row.draft_enabled || row.payment_enabled) throw new EntryFault("ENTRY_LOCKED", 409);
        const at = now();
        if (row.closes_at === null || at >= row.closes_at) throw new EntryFault("DEADLINE_PASSED", 409);
        const verificationCount = z.object({ count: z.coerce.number().int() }).parse((await db.query(`SELECT count(DISTINCT code) AS count
          FROM gyca_launch_verifications WHERE competition_id=$1 AND competition_revision=$2 AND valid_until>$3`,
        [competitionId, row.revision, at])).rows[0]).count;
        if (verificationCount !== 3) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
        const revision = row.revision + 1;
        await db.query("UPDATE gyca_competitions SET draft_enabled=true,payment_enabled=true,revision=$2 WHERE id=$1",
          [competitionId, revision]);
        await db.query(`INSERT INTO gyca_application_opens
          (action_id,competition_id,previous_revision,resulting_revision,actor_id,reason,readiness_snapshot,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`, [input.actionId, competitionId, row.revision, revision, actor,
          input.reason, JSON.stringify(readiness), at]);
        return OpenedApplicationsSchema.parse({ actionId: input.actionId, competitionId, revision,
          draftEnabled: true, paymentEnabled: true, openedAt: at.toISOString() });
      });
    },
  };
}
