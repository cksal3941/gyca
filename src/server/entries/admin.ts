import { z } from "zod";
import { AdminEntriesPageSchema, AdminFileStateSchema } from "../../contracts/admin-entries.ts";
import { ENTRY_STATUSES, PAYMENT_STATES, PUBLISHED_RESULTS, REVIEW_STATUSES, EntryIdSchema, OrderIdSchema } from "../../contracts/index.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, parseRequest } from "./http.ts";

const sortSchema = z.enum(["created_desc", "created_asc", "name_asc"]);
const rowSchema = z.object({ id: EntryIdSchema, participant_name: z.string().nullable(), participant_sort: z.string(), status: z.enum(ENTRY_STATUSES),
  work_title: z.string().nullable(), category: z.string().nullable(), age_group: z.string().nullable(),
  review_status: z.enum(REVIEW_STATUSES), published_result: z.enum(PUBLISHED_RESULTS).nullable(),
  file_state: AdminFileStateSchema, certificate_issued: z.boolean(), stage_certificate_issued: z.boolean(), has_submission: z.boolean(),
  created_at: z.date(), submitted_at: z.date().nullable(), received_at: z.date().nullable(), receipt_number: z.string().nullable(),
  order_id: OrderIdSchema.nullable(), payment_state: z.enum(PAYMENT_STATES).nullable(),
  amount_minor: z.coerce.number().int().safe().nullable(), currency: z.literal("EUR").nullable(),
  needs_review: z.boolean().nullable(), live_mode: z.boolean().nullable() });
const cursorSchema = z.object({ v: z.literal(1), sort: sortSchema, value: z.string(), id: z.uuid() });

function encodeCursor(row: z.infer<typeof rowSchema>, sort: z.infer<typeof sortSchema>) {
  const value = sort === "name_asc" ? row.participant_sort : row.created_at.toISOString();
  return Buffer.from(JSON.stringify({ v: 1, sort, value, id: row.id })).toString("base64url");
}
function decodeCursor(value: string | null, sort: z.infer<typeof sortSchema>) {
  if (value === null) return null;
  try {
    const parsed = cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (parsed.sort !== sort) throw new Error("sort mismatch");
    if (sort !== "name_asc") z.iso.datetime().parse(parsed.value);
    return parsed;
  } catch { throw new EntryFault("VALIDATION_FAILED", 422); }
}

export function createAdminEntriesHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, competitionId: string) => run(request, false, 200, actor => {
    const competition = parseRequest(z.string().min(1).max(128), competitionId);
    const params = new URL(request.url).searchParams;
    for (const key of ["q", "cursor", "entryStatus", "paymentState", "publishedResult", "sort", "limit"])
      if (params.getAll(key).length > 1) throw new EntryFault("VALIDATION_FAILED", 422);
    const query = parseRequest(z.string().max(200).trim(), params.get("q") ?? "");
    const status = parseRequest(z.enum(ENTRY_STATUSES).nullable(), params.get("entryStatus"));
    const payment = parseRequest(z.enum(PAYMENT_STATES).nullable(), params.get("paymentState"));
    const result = parseRequest(z.union([z.enum(PUBLISHED_RESULTS), z.literal("not_announced")]).nullable(), params.get("publishedResult"));
    const sort = parseRequest(sortSchema, params.get("sort") ?? "created_desc");
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    const cursor = decodeCursor(parseRequest(z.string().max(2048).nullable(), params.get("cursor")), sort);
    return deps.database.transaction(async db => {
      if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
        throw new EntryFault("FORBIDDEN", 403);
      if ((await db.query("SELECT id FROM gyca_competitions WHERE id=$1", [competition])).rows.length === 0)
        throw new EntryFault("NOT_FOUND", 404);
      const base = `WITH scoped AS (SELECT e.id,
        (CASE WHEN s.entry_id IS NULL THEN e.participant ELSE s.snapshot->'participant' END)->>'name' AS participant_name,
        lower(COALESCE((CASE WHEN s.entry_id IS NULL THEN e.participant ELSE s.snapshot->'participant' END)->>'name','')) AS participant_sort,
        e.status,e.created_at,e.submitted_at,e.received_at,e.receipt_number,e.review_status,e.published_result,
        COALESCE(NULLIF(btrim((CASE WHEN s.entry_id IS NULL THEN e.work ELSE s.snapshot->'work' END)->>'englishTitle'),''),
          NULLIF(btrim((CASE WHEN s.entry_id IS NULL THEN e.work ELSE s.snapshot->'work' END)->>'title'),'')) AS work_title,
        (CASE WHEN s.entry_id IS NULL THEN e.work ELSE s.snapshot->'work' END)->>'category' AS category,
        s.snapshot->>'ageGroup' AS age_group,o.id AS order_id,o.state AS payment_state,o.amount_minor,o.currency,o.needs_review,o.live_mode,
        CASE WHEN s.entry_id IS NOT NULL THEN 'ready' ELSE COALESCE(files.file_state,'pending') END AS file_state,e.certificate_count>0 AS certificate_issued,
        stage_certificate.id IS NOT NULL AS stage_certificate_issued,s.entry_id IS NOT NULL AS has_submission
        FROM gyca_entries e LEFT JOIN gyca_orders o ON o.entry_id=e.id LEFT JOIN gyca_submissions s ON s.entry_id=e.id
        LEFT JOIN LATERAL (SELECT CASE WHEN count(*)=0 THEN 'pending' WHEN bool_or(a.state='rejected') THEN 'rejected'
          WHEN bool_or(a.state='validating') THEN 'validating' WHEN bool_or(a.state IN ('pending_upload','uploaded')) THEN 'pending'
          ELSE 'ready' END AS file_state FROM gyca_assets a WHERE a.entry_id=e.id AND a.removed_at IS NULL) files ON true
        LEFT JOIN gyca_certificates stage_certificate ON stage_certificate.entry_id=e.id AND stage_certificate.stage=e.published_result
          AND stage_certificate.state='issued'
        WHERE e.competition_id=$1 AND ($2::text IS NULL OR e.status=$2) AND ($3::text IS NULL OR o.state=$3)
          AND ($4::text IS NULL OR ($4='not_announced' AND e.published_result IS NULL) OR e.published_result=$4)),
        filtered AS (SELECT * FROM scoped WHERE $5::text='' OR strpos(lower(COALESCE(participant_name,'')),lower($5))>0
          OR strpos(lower(COALESCE(work_title,'')),lower($5))>0
          OR (status='received' AND strpos(lower(COALESCE(receipt_number,'')),lower($5))>0))`;
      const values = [competition, status, payment, result, query];
      const totalRow = (await db.query(`${base} SELECT count(*) AS total FROM filtered`, values)).rows[0];
      const total = z.object({ total: z.coerce.number().int().nonnegative() }).parse(totalRow).total;
      const cursorValue = cursor?.value ?? null; const cursorId = cursor?.id ?? null;
      const order = sort === "created_desc" ? "created_at DESC,id DESC" : sort === "created_asc" ? "created_at,id" : "participant_sort,id";
      const rows = (await db.query(`${base} SELECT * FROM filtered WHERE $6::text IS NULL OR
        ($8='created_desc' AND (created_at,id)<($6::timestamptz,$7::uuid)) OR
        ($8='created_asc' AND (created_at,id)>($6::timestamptz,$7::uuid)) OR
        ($8='name_asc' AND (participant_sort,id)>($6,$7::uuid))
        ORDER BY ${order} LIMIT $9`, [...values, cursorValue, cursorId, sort, limit + 1])).rows.map(row => rowSchema.parse(row));
      const page = rows.slice(0, limit);
      return AdminEntriesPageSchema.parse({ items: page.map(row => ({ id: row.id, participantName: row.participant_name,
        entryStatus: row.status, workTitle: row.work_title, category: row.category, ageGroup: row.age_group,
        reviewStatus: row.review_status, publishedResult: row.published_result, fileState: row.file_state,
        certificateIssued: row.certificate_issued, createdAt: row.created_at.toISOString(), submittedAt: row.submitted_at?.toISOString() ?? null,
        receivedAt: row.status === "received" ? row.received_at?.toISOString() ?? null : null,
        receiptNumber: row.status === "received" ? row.receipt_number : null,
        payment: row.order_id === null ? null : { id: row.order_id, state: row.payment_state,
          money: { amountMinor: row.amount_minor, currency: row.currency }, needsReview: row.needs_review, liveMode: row.live_mode },
        allowedActions: [...(row.has_submission ? ["view_guardian_consents" as const] : []),
          ...(row.published_result !== null && row.published_result !== "not_selected" && !row.stage_certificate_issued
            ? ["issue_certificate" as const] : [])],
      })), nextCursor: rows.length > limit && page.length ? encodeCursor(page.at(-1)!, sort) : null, total });
    });
  });
}
