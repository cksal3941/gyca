import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { ENTRY_STATUSES, PAYMENT_STATES, PUBLISHED_RESULTS, REVIEW_STATUSES } from "../../contracts/index.ts";
import type { EntryExportRequest } from "../../contracts/entry-export.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";

const MAX_ROWS = 10000;
const MAX_BYTES = 20 * 1024 * 1024;
const rowSchema = z.object({
  id: z.uuid(), owner_email: z.string().nullable(), participant_name: z.string().nullable(), participant_name_en: z.string().nullable(),
  date_of_birth: z.string().nullable(), residence_country: z.string().nullable(), nationality: z.string().nullable(),
  school: z.string().nullable(), grade: z.string().nullable(), guardian_name: z.string().nullable(), guardian_email: z.string().nullable(),
  work_title: z.string().nullable(), original_title: z.string().nullable(), category: z.string().nullable(), age_group: z.string().nullable(),
  status: z.enum(ENTRY_STATUSES), review_status: z.enum(REVIEW_STATUSES), published_result: z.enum(PUBLISHED_RESULTS).nullable(),
  created_at: z.coerce.date(), submitted_at: z.coerce.date().nullable(), received_at: z.coerce.date().nullable(),
  receipt_number: z.string().nullable(), payment_state: z.enum(PAYMENT_STATES).nullable(), amount_minor: z.coerce.number().int().nullable(),
  currency: z.literal("EUR").nullable(), needs_review: z.boolean().nullable(),
});

function csvCell(input: unknown) {
  let value = input === null || input === undefined ? "" : input instanceof Date ? input.toISOString() : String(input);
  if (/^[\s]*[=+\-@]/.test(value) || /^[\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replace(/"/g, '""')}"`;
}

export function createEntryExport(database: EntryDatabase, now: () => Date) {
  return (actor: string, competitionId: string, input: EntryExportRequest) => database.transaction(async db => {
    if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
      throw new EntryFault("FORBIDDEN", 403);
    if ((await db.query("SELECT id FROM gyca_competitions WHERE id=$1 FOR SHARE", [competitionId])).rows.length === 0)
      throw new EntryFault("NOT_FOUND", 404);
    const filters = { q: input.q ?? "", entryStatus: input.entryStatus ?? null, paymentState: input.paymentState ?? null,
      publishedResult: input.publishedResult ?? null, sort: input.sort ?? "created_desc" } as const;
    const order = filters.sort === "created_desc" ? "e.created_at DESC,e.id DESC"
      : filters.sort === "created_asc" ? "e.created_at,e.id" : "participant_sort,e.id";
    const rows = (await db.query(`SELECT e.id,u.email AS owner_email,
      data.participant->>'name' AS participant_name,data.participant->>'nameEn' AS participant_name_en,
      data.participant->>'dateOfBirth' AS date_of_birth,data.participant->>'residenceCountry' AS residence_country,
      data.participant->>'nationality' AS nationality,data.participant->>'school' AS school,data.participant->>'grade' AS grade,
      data.guardian->>'name' AS guardian_name,data.guardian->>'email' AS guardian_email,
      COALESCE(NULLIF(btrim(data.work->>'englishTitle'),''),NULLIF(btrim(data.work->>'title'),'')) AS work_title,
      data.work->>'title' AS original_title,data.work->>'category' AS category,s.snapshot->>'ageGroup' AS age_group,
      lower(COALESCE(data.participant->>'name','')) AS participant_sort,e.status,e.review_status,e.published_result,
      e.created_at,e.submitted_at,e.received_at,e.receipt_number,o.state AS payment_state,o.amount_minor,o.currency,o.needs_review
      FROM gyca_entries e JOIN "user" u ON u.id=e.owner_id LEFT JOIN gyca_submissions s ON s.entry_id=e.id
      LEFT JOIN gyca_orders o ON o.entry_id=e.id
      CROSS JOIN LATERAL (SELECT CASE WHEN s.entry_id IS NULL THEN e.participant ELSE s.snapshot->'participant' END AS participant,
        CASE WHEN s.entry_id IS NULL THEN e.work ELSE s.snapshot->'work' END AS work,
        CASE WHEN s.entry_id IS NULL THEN e.guardian ELSE s.snapshot->'guardian' END AS guardian) data
      WHERE e.competition_id=$1 AND ($2::text IS NULL OR e.status=$2) AND ($3::text IS NULL OR o.state=$3)
        AND ($4::text IS NULL OR ($4='not_announced' AND e.published_result IS NULL) OR e.published_result=$4)
        AND ($5::text='' OR strpos(lower(COALESCE(data.participant->>'name','')),lower($5))>0
          OR strpos(lower(COALESCE(data.work->>'englishTitle',data.work->>'title','')),lower($5))>0
          OR (e.status='received' AND strpos(lower(COALESCE(e.receipt_number,'')),lower($5))>0))
      ORDER BY ${order} LIMIT $6`, [competitionId, filters.entryStatus, filters.paymentState, filters.publishedResult,
      filters.q, MAX_ROWS + 1])).rows.map(row => rowSchema.parse(row));
    if (rows.length > MAX_ROWS) throw new EntryFault("VALIDATION_FAILED", 422);
    const headers = ["entryId","receiptNumber","entryStatus","accountEmail","participantName","participantNameEn","dateOfBirth",
      "residenceCountry","nationality","school","grade","guardianName","guardianEmail","workTitle","originalTitle","category",
      "ageGroup","createdAt","submittedAt","receivedAt","paymentState","amountMinor","currency","needsReview","reviewStatus","publishedResult"];
    const lines = [headers, ...rows.map(row => [row.id,row.receipt_number,row.status,row.owner_email,row.participant_name,row.participant_name_en,
      row.date_of_birth,row.residence_country,row.nationality,row.school,row.grade,row.guardian_name,row.guardian_email,row.work_title,
      row.original_title,row.category,row.age_group,row.created_at,row.submitted_at,row.received_at,row.payment_state,row.amount_minor,row.currency,
      row.needs_review,row.review_status,row.published_result])].map(values => values.map(csvCell).join(","));
    const bytes = Buffer.from(`\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
    if (bytes.byteLength > MAX_BYTES) throw new EntryFault("VALIDATION_FAILED", 413);
    const exportId = randomUUID(); const createdAt = now();
    await db.query(`INSERT INTO gyca_entry_exports(id,competition_id,actor_id,filters,row_count,content_sha256,created_at)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)`, [exportId, competitionId, actor, JSON.stringify(filters), rows.length,
      createHash("sha256").update(bytes).digest("hex"), createdAt]);
    return { exportId, bytes, rowCount: rows.length, createdAt };
  });
}
