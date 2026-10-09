import { z } from "zod";
import { AdminDashboardSchema } from "../../contracts/admin-dashboard.ts";
import { LocalizedTextSchema } from "../../contracts/index.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";

const count = z.coerce.number().int().nonnegative().safe();
const competitionRowSchema = z.object({
  id: z.string().min(1).max(128), slug: z.string().min(1).max(128), title: z.unknown(), published: z.boolean(),
  phase: z.enum(["scheduled", "judging", "result", "archived"]), total_entries: count, unique_applicants: count,
  draft: count, submitted: count, received: count, withdrawn: count, expired_entries: count,
  total_payments: count, pending_payments: count, succeeded_payments: count, failed_payments: count,
  cancelled_payments: count, expired_payments: count, needs_review: count, succeeded_amount_minor: count,
  review_not_started: count, review_under_review: count, review_completed: count,
  active_assignments: count, submitted_assignments: count, result_not_announced: count,
  result_official_selection: count, result_finalist: count, result_not_selected: count,
});
const countryRowSchema = z.object({ country: z.string().nullable(), count });
const applicantSummarySchema = z.object({ unique_accounts: count, unknown_country: count });

export function createAdminDashboardHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request) => run(request, false, 200, actor => {
    const params = new URL(request.url).searchParams;
    for (const key of params.keys()) if (!(["limit", "cursor"].includes(key)) || params.getAll(key).length !== 1)
      throw new EntryFault("VALIDATION_FAILED", 422);
    const limit = parseRequest(z.coerce.number().int().min(1).max(50), params.get("limit") ?? 20);
    const cursor = parseRequest(z.string().min(1).max(128).nullable(), params.get("cursor"));
    return deps.database.transaction(async db => {
      if (!(await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length)
        throw new EntryFault("FORBIDDEN", 403);
      const measuredAt = deps.now();
      const accountRow = z.object({ total: count }).parse((await db.query('SELECT count(*) AS total FROM "user"')).rows[0]);
      const applicantSummary = applicantSummarySchema.parse((await db.query(`WITH ranked AS (
        SELECT e.owner_id,NULLIF(btrim(COALESCE(
          CASE WHEN s.entry_id IS NULL THEN e.participant->>'residenceCountry' ELSE s.snapshot->'participant'->>'residenceCountry' END,'')), '') AS country,
          row_number() OVER(PARTITION BY e.owner_id ORDER BY COALESCE(e.submitted_at,e.updated_at,e.created_at) DESC,e.id DESC) AS position
        FROM gyca_entries e LEFT JOIN gyca_submissions s ON s.entry_id=e.id)
        SELECT count(*) AS unique_accounts,count(*) FILTER(WHERE country IS NULL) AS unknown_country
        FROM ranked WHERE position=1`)).rows[0]);
      const countries = (await db.query(`WITH ranked AS (
        SELECT e.owner_id,NULLIF(btrim(COALESCE(
          CASE WHEN s.entry_id IS NULL THEN e.participant->>'residenceCountry' ELSE s.snapshot->'participant'->>'residenceCountry' END,'')), '') AS country,
          row_number() OVER(PARTITION BY e.owner_id ORDER BY COALESCE(e.submitted_at,e.updated_at,e.created_at) DESC,e.id DESC) AS position
        FROM gyca_entries e LEFT JOIN gyca_submissions s ON s.entry_id=e.id)
        SELECT country,count(*) AS count FROM ranked WHERE position=1 AND country IS NOT NULL
        GROUP BY country ORDER BY count(*) DESC,country LIMIT 250`)).rows.map(row => countryRowSchema.parse(row));
      const competitionTotal = z.object({ total: count }).parse((await db.query("SELECT count(*) AS total FROM gyca_competitions")).rows[0]).total;
      const rows = (await db.query(`SELECT c.id,c.slug,c.public_content->'title' AS title,c.published,c.phase,
        count(DISTINCT e.id) AS total_entries,count(DISTINCT e.owner_id) AS unique_applicants,
        count(DISTINCT e.id) FILTER(WHERE e.status='draft') AS draft,
        count(DISTINCT e.id) FILTER(WHERE e.status='submitted') AS submitted,
        count(DISTINCT e.id) FILTER(WHERE e.status='received') AS received,
        count(DISTINCT e.id) FILTER(WHERE e.status='withdrawn') AS withdrawn,
        count(DISTINCT e.id) FILTER(WHERE e.status='expired') AS expired_entries,
        count(DISTINCT o.id) AS total_payments,
        count(DISTINCT o.id) FILTER(WHERE o.state='pending') AS pending_payments,
        count(DISTINCT o.id) FILTER(WHERE o.state='succeeded') AS succeeded_payments,
        count(DISTINCT o.id) FILTER(WHERE o.state='failed') AS failed_payments,
        count(DISTINCT o.id) FILTER(WHERE o.state='cancelled') AS cancelled_payments,
        count(DISTINCT o.id) FILTER(WHERE o.state='expired') AS expired_payments,
        count(DISTINCT o.id) FILTER(WHERE o.needs_review) AS needs_review,
        COALESCE((SELECT sum(o2.amount_minor) FROM gyca_orders o2 JOIN gyca_entries e2 ON e2.id=o2.entry_id
          WHERE e2.competition_id=c.id AND o2.state='succeeded'),0) AS succeeded_amount_minor,
        count(DISTINCT e.id) FILTER(WHERE e.review_status='not_started') AS review_not_started,
        count(DISTINCT e.id) FILTER(WHERE e.review_status='under_review') AS review_under_review,
        count(DISTINCT e.id) FILTER(WHERE e.review_status='completed') AS review_completed,
        count(DISTINCT a.id) FILTER(WHERE v.assignment_id IS NULL) AS active_assignments,
        count(DISTINCT a.id) FILTER(WHERE v.assignment_id IS NULL AND jr.state='submitted') AS submitted_assignments,
        count(DISTINCT e.id) FILTER(WHERE e.published_result IS NULL) AS result_not_announced,
        count(DISTINCT e.id) FILTER(WHERE e.published_result='official_selection') AS result_official_selection,
        count(DISTINCT e.id) FILTER(WHERE e.published_result='finalist') AS result_finalist,
        count(DISTINCT e.id) FILTER(WHERE e.published_result='not_selected') AS result_not_selected
        FROM gyca_competitions c LEFT JOIN gyca_entries e ON e.competition_id=c.id
        LEFT JOIN gyca_orders o ON o.entry_id=e.id LEFT JOIN gyca_judge_assignments a ON a.entry_id=e.id
        LEFT JOIN gyca_judge_assignment_revocations v ON v.assignment_id=a.id LEFT JOIN gyca_judge_reviews jr ON jr.assignment_id=a.id
        WHERE ($1::text IS NULL OR c.id>$1) GROUP BY c.id ORDER BY c.id LIMIT $2`, [cursor, limit + 1])).rows.map(row => competitionRowSchema.parse(row));
      const page = rows.slice(0, limit);
      const countryItems = countries.map(row => ({ country: row.country!, count: row.count }));
      return AdminDashboardSchema.parse({ measuredAt: measuredAt.toISOString(), accounts: accountRow,
        applicants: { uniqueAccounts: applicantSummary.unique_accounts,
          unknownResidenceCountry: applicantSummary.unknown_country,
          byResidenceCountry: countryItems }, competitions: { total: competitionTotal,
          nextCursor: rows.length > limit ? page.at(-1)?.id ?? null : null,
          items: page.map(row => ({ id: row.id, slug: row.slug,
            title: LocalizedTextSchema.safeParse(row.title).success ? LocalizedTextSchema.parse(row.title) : null,
            published: row.published, phase: row.phase,
            entries: { total: row.total_entries, uniqueApplicants: row.unique_applicants, draft: row.draft,
              submitted: row.submitted, received: row.received, withdrawn: row.withdrawn, expired: row.expired_entries },
            payments: { total: row.total_payments, pending: row.pending_payments, succeeded: row.succeeded_payments,
              failed: row.failed_payments, cancelled: row.cancelled_payments, expired: row.expired_payments,
              needsReview: row.needs_review, succeededAmountMinor: row.succeeded_amount_minor, currency: "EUR" },
            reviews: { notStarted: row.review_not_started, underReview: row.review_under_review,
              completed: row.review_completed, activeAssignments: row.active_assignments,
              submittedAssignments: row.submitted_assignments },
            results: { notAnnounced: row.result_not_announced, officialSelection: row.result_official_selection,
              finalist: row.result_finalist, notSelected: row.result_not_selected },
          })) } });
    });
  });
}
