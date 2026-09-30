import { z } from "zod";
import { AdminEntryDetailSchema } from "../../contracts/admin-entry-detail.ts";
import { AdminFileStateSchema } from "../../contracts/admin-entries.ts";
import { CertificateStageSchema } from "../../contracts/certificates.ts";
import { ASSET_PURPOSES, ENTRY_STATUSES, PAYMENT_STATES, PUBLISHED_RESULTS, REJECTION_CODES, REVIEW_STATUSES,
  ParticipantDraftSchema, WorkDraftSchema } from "../../contracts/index.ts";
import { CONSENT_KINDS } from "../../contracts/submissions.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, parseRequest } from "./http.ts";

const entryRowSchema = z.object({ id: z.uuid(), owner_id: z.string(), status: z.enum(ENTRY_STATUSES), revision: z.number().int(),
  participant: z.unknown(), work: z.unknown(), created_at: z.date(), submitted_at: z.date().nullable(), received_at: z.date().nullable(),
  receipt_number: z.string().nullable(), review_status: z.enum(REVIEW_STATUSES), published_result: z.enum(PUBLISHED_RESULTS).nullable(),
  certificate_count: z.number().int(), snapshot: z.unknown().nullable(), order_id: z.uuid().nullable(), payment_state: z.enum(PAYMENT_STATES).nullable(),
  amount_minor: z.coerce.number().int().nullable(), currency: z.literal("EUR").nullable(), needs_review: z.boolean().nullable(), live_mode: z.boolean().nullable(),
  file_state: AdminFileStateSchema, stage_certificate_issued: z.boolean() });
const snapshotSchema = z.object({ participant: ParticipantDraftSchema, work: WorkDraftSchema, ageGroup: z.string().nullable(),
  assets: z.array(z.object({ id: z.uuid(), purpose: z.enum(ASSET_PURPOSES), display_name: z.string(), declared_type: z.string(),
    size_bytes: z.number().int(), page_count: z.number().int().nullable(), state: z.enum(["pending_upload", "uploaded", "validating", "ready", "rejected"]) })),
  consents: z.array(z.object({ kind: z.enum(CONSENT_KINDS), version: z.string(), locale: z.enum(["en", "ko"]), acceptedAt: z.iso.datetime() })),
});
const auditType = z.enum(["entry.created", "entry.submitted", "payment.succeeded", "entry.received", "review.updated", "result.published",
  "final_participation.updated", "certificate.queued", "certificate.issued", "certificate.retry_scheduled", "certificate.stalled"]);

export function createAdminEntryDetailHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string, entryId: string) => run(request, false, 200, actor => {
    const competition = parseRequest(z.string().min(1).max(128), competitionId); const entry = parseRequest(z.uuid(), entryId);
    return deps.database.transaction(async db => {
      if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
        throw new EntryFault("FORBIDDEN", 403);
      const raw = (await db.query(`SELECT e.*,s.snapshot,o.id AS order_id,o.state AS payment_state,o.amount_minor,o.currency,o.needs_review,o.live_mode,
        CASE WHEN s.entry_id IS NOT NULL THEN 'ready' ELSE COALESCE(files.file_state,'pending') END AS file_state,
        stage_certificate.id IS NOT NULL AS stage_certificate_issued
        FROM gyca_entries e LEFT JOIN gyca_submissions s ON s.entry_id=e.id LEFT JOIN gyca_orders o ON o.entry_id=e.id
        LEFT JOIN LATERAL (SELECT CASE WHEN count(*)=0 THEN 'pending' WHEN bool_or(a.state='rejected') THEN 'rejected'
          WHEN bool_or(a.state='validating') THEN 'validating' WHEN bool_or(a.state IN ('pending_upload','uploaded')) THEN 'pending'
          ELSE 'ready' END AS file_state FROM gyca_assets a WHERE a.entry_id=e.id AND a.removed_at IS NULL) files ON true
        LEFT JOIN gyca_certificates stage_certificate ON stage_certificate.entry_id=e.id AND stage_certificate.stage=e.published_result
          AND stage_certificate.state='issued' WHERE e.id=$1 AND e.competition_id=$2`, [entry, competition])).rows[0];
      if (!raw) throw new EntryFault("NOT_FOUND", 404);
      const row = entryRowSchema.parse(raw); const frozen = row.snapshot === null ? null : snapshotSchema.parse(row.snapshot);
      const participant = frozen?.participant ?? ParticipantDraftSchema.parse(row.participant);
      const work = frozen?.work ?? WorkDraftSchema.parse(row.work);
      const currentAssets = frozen ? [] : (await db.query(`SELECT id,purpose,display_name,declared_type,size_bytes,page_count,state,rejection_code
        FROM gyca_assets WHERE entry_id=$1 AND removed_at IS NULL ORDER BY id`, [entry])).rows.map(asset => z.object({ id: z.uuid(), purpose: z.enum(ASSET_PURPOSES),
        display_name: z.string(), declared_type: z.string(), size_bytes: z.coerce.number().int(), page_count: z.number().int().nullable(),
        state: z.enum(["pending_upload", "uploaded", "validating", "ready", "rejected"]), rejection_code: z.enum(REJECTION_CODES).nullable() }).parse(asset));
      const files = frozen ? frozen.assets.map(asset => ({ id: asset.id, purpose: asset.purpose, displayName: asset.display_name,
        mediaType: asset.declared_type, sizeBytes: asset.size_bytes, pageCount: asset.page_count, state: asset.state, rejectionCode: null }))
        : currentAssets.map(asset => ({ id: asset.id, purpose: asset.purpose, displayName: asset.display_name, mediaType: asset.declared_type,
          sizeBytes: asset.size_bytes, pageCount: asset.page_count, state: asset.state, rejectionCode: asset.rejection_code }));
      const guardianRaw = (await db.query(`SELECT r.entry_revision,r.expires_at,c.accepted_at,v.verified_at FROM gyca_guardian_requests r
        LEFT JOIN gyca_guardian_consents c ON c.request_id=r.id LEFT JOIN gyca_guardian_verifications v ON v.request_id=r.id
        WHERE r.entry_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 1`, [entry])).rows[0];
      const guardian = guardianRaw ? z.object({ entry_revision: z.number().int(), expires_at: z.date(), accepted_at: z.date().nullable(),
        verified_at: z.date().nullable() }).parse(guardianRaw) : null;
      const guardianVerificationStatus = guardian === null ? "not_verified" : frozen === null && guardian.entry_revision !== row.revision ? "stale"
        : guardian.verified_at ? "verified" : guardian.accepted_at ? (guardian.expires_at <= deps.now() ? "expired" : "pending_review") : "not_verified";
      const certificates = (await db.query("SELECT id,stage,state,issued_at FROM gyca_certificates WHERE entry_id=$1 ORDER BY stage", [entry])).rows.map(rawCertificate => {
        const certificate = z.object({ id: z.uuid(), stage: CertificateStageSchema, state: z.enum(["pending", "running", "issued", "stalled"]),
          issued_at: z.date().nullable() }).parse(rawCertificate);
        return { id: certificate.id, stage: certificate.stage, state: certificate.state === "running" ? "pending" as const : certificate.state,
          issuedAt: certificate.issued_at?.toISOString() ?? null };
      });
      const auditRows = await db.query(`SELECT * FROM (
        SELECT 'entry-'||e.id::text AS id,'entry.created' AS type,e.owner_id AS actor_id,e.created_at AS occurred_at FROM gyca_entries e WHERE e.id=$1
        UNION ALL SELECT 'submission-'||s.entry_id::text,'entry.submitted',e.owner_id,s.submitted_at FROM gyca_submissions s JOIN gyca_entries e ON e.id=s.entry_id WHERE s.entry_id=$1
        UNION ALL SELECT 'payment-'||o.id::text,'payment.succeeded',NULL,o.paid_at FROM gyca_orders o WHERE o.entry_id=$1 AND o.state='succeeded'
        UNION ALL SELECT 'receipt-'||e.id::text,'entry.received',NULL,e.received_at FROM gyca_entries e WHERE e.id=$1 AND e.received_at IS NOT NULL
        UNION ALL SELECT 'review-'||c.entry_id::text||'-'||c.revision::text,'review.updated',c.actor_id,c.created_at FROM gyca_entry_review_changes c WHERE c.entry_id=$1
        UNION ALL SELECT 'result-'||p.round||'-'||p.entry_id::text,'result.published',p.actor_id,p.published_at FROM gyca_entry_result_round_publications p WHERE p.entry_id=$1
        UNION ALL SELECT 'final-'||c.entry_id::text||'-'||c.revision::text,'final_participation.updated',c.actor_id,c.created_at FROM gyca_final_participation_changes c WHERE c.entry_id=$1
        UNION ALL SELECT 'certificate-'||ev.id::text,CASE ev.event WHEN 'queued' THEN 'certificate.queued' WHEN 'issued' THEN 'certificate.issued'
          WHEN 'retry_scheduled' THEN 'certificate.retry_scheduled' ELSE 'certificate.stalled' END,b.actor_id,ev.created_at
          FROM gyca_certificate_events ev JOIN gyca_certificates cert ON cert.id=ev.certificate_id
          LEFT JOIN LATERAL (SELECT batch.actor_id FROM gyca_certificate_issue_batch_items item
            JOIN gyca_certificate_issue_batches batch ON batch.id=item.batch_id WHERE item.certificate_id=cert.id
            ORDER BY batch.created_at,batch.id LIMIT 1) b ON true WHERE cert.entry_id=$1
        ) events ORDER BY occurred_at DESC,id DESC LIMIT 100`, [entry]);
      const audit = auditRows.rows.map(event => {
        const parsed = z.object({ id: z.string(), type: auditType, actor_id: z.string().nullable(), occurred_at: z.date() }).parse(event);
        return { id: parsed.id, type: parsed.type, actorId: parsed.actor_id, occurredAt: parsed.occurred_at.toISOString() };
      });
      const workTitle = (work.englishTitle?.trim() || work.title?.trim()) ?? null;
      const allowedActions = [...(frozen ? ["view_guardian_consents" as const] : []),
        ...(row.published_result && row.published_result !== "not_selected" && !row.stage_certificate_issued ? ["issue_certificate" as const] : [])];
      return AdminEntryDetailSchema.parse({ id: row.id, participantName: participant.name ?? null, entryStatus: row.status,
        workTitle, category: work.category ?? null, ageGroup: frozen?.ageGroup ?? null, reviewStatus: row.review_status,
        publishedResult: row.published_result, fileState: row.file_state, certificateIssued: row.certificate_count > 0,
        createdAt: row.created_at.toISOString(), submittedAt: row.submitted_at?.toISOString() ?? null,
        receivedAt: row.status === "received" ? row.received_at?.toISOString() ?? null : null,
        receiptNumber: row.status === "received" ? row.receipt_number : null,
        payment: row.order_id ? { id: row.order_id, state: row.payment_state, money: { amountMinor: row.amount_minor, currency: row.currency },
          needsReview: row.needs_review, liveMode: row.live_mode } : null,
        allowedActions, participant, work, files, guardianVerificationStatus,
        consents: frozen?.consents.map(consent => ({ kind: consent.kind, version: consent.version, locale: consent.locale,
          acceptedAt: consent.acceptedAt })) ?? [], certificates, audit });
    });
  });
}
