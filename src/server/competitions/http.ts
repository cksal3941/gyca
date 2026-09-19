import { randomUUID } from "node:crypto";
import { z } from "zod";
import { COMPETITION_STATUSES } from "../../contracts/index.ts";
import type { SqlConnection } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { CompetitionRowSchema, projectCompetition } from "./policy.ts";

const inputSchema = z.object({ cursor: z.string().min(1).max(128).nullable(),
  limit: z.coerce.number().int().min(1).max(50), status: z.enum(COMPETITION_STATUSES).nullable() });

export function createCompetitionHandlers(db: SqlConnection, now: () => Date) {
  async function run(action: (at: Date) => Promise<unknown>) {
    const at = now();
    const meta = { requestId: randomUUID(), serverTime: at.toISOString() };
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    try { return Response.json({ data: await action(at), meta }, { headers }); }
    catch (error) {
      if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code, retryable: false, fieldErrors: [] }, meta }, { status: error.status, headers });
      console.error("Competition request failed", { requestId: meta.requestId });
      return Response.json({ error: { code: "INTERNAL_ERROR", message: "Request could not be completed", retryable: false, fieldErrors: [] }, meta }, { status: 500, headers });
    }
  }
  return {
    get: (_request: Request, slug: string) => run(async (at) => {
      if (!z.string().min(1).max(128).safeParse(slug).success) throw new EntryFault("VALIDATION_FAILED", 422);
      const result = await db.query("SELECT * FROM gyca_competitions WHERE slug=$1 AND published=true AND public_content IS NOT NULL", [slug]);
      if (result.rows[0] === undefined) throw new EntryFault("NOT_FOUND", 404);
      return projectCompetition(CompetitionRowSchema.parse(result.rows[0]), at);
    }),
    list: (request: Request) => run(async (at) => {
      const params = new URL(request.url).searchParams;
      const parsed = inputSchema.safeParse({ cursor: params.get("cursor"), limit: params.get("limit") ?? 20, status: params.get("status") });
      if (!parsed.success) throw new EntryFault("VALIDATION_FAILED", 422);
      const { cursor, limit, status } = parsed.data;
      const result = await db.query(`SELECT * FROM gyca_competitions WHERE published=true AND public_content IS NOT NULL
        AND ($1::text IS NULL OR id>$1) AND ($2::text IS NULL OR
          CASE WHEN phase='archived' THEN 'archived' WHEN phase='judging' THEN 'judging' WHEN phase='result' THEN 'result'
          WHEN opens_at IS NULL OR $3::timestamptz<opens_at THEN 'upcoming'
          WHEN closes_at IS NOT NULL AND $3::timestamptz>=closes_at THEN 'closed' ELSE 'open' END = $2)
        ORDER BY id LIMIT $4`, [cursor, status, at.toISOString(), limit + 1]);
      const rows = z.array(CompetitionRowSchema).parse(result.rows);
      const page = rows.slice(0, limit);
      return { items: page.map((row) => projectCompetition(row, at)), nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
    }),
  };
}
