import { z } from "zod";
import { SubmissionRecordSchema } from "../../contracts/submission-record.ts";
import type { EntryDatabase } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { createAuthenticatedRunner, parseRequest } from "./http.ts";

const snapshotSchema = z.object({
  participant: z.unknown(), work: z.unknown(), consents: z.unknown(), ageGroup: z.string().nullable(),
  assets: z.array(z.object({ id: z.string(), purpose: z.string(), display_name: z.string(), declared_type: z.string(),
    size_bytes: z.number(), page_count: z.number().nullable() })),
});

export function createSubmissionRecordHandler(deps: {
  readonly database: EntryDatabase; readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, entryId: string) => run(request, false, 200, async owner => {
    const id = parseRequest(z.uuid(), entryId);
    const raw = (await deps.database.query(`SELECT e.competition_id,s.submitted_at,s.snapshot
      FROM gyca_submissions s JOIN gyca_entries e ON e.id=s.entry_id
      WHERE s.entry_id=$1 AND e.owner_id=$2`, [id, owner])).rows[0];
    if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
    const row = z.object({ competition_id: z.string(), submitted_at: z.date(), snapshot: snapshotSchema }).parse(raw);
    const snapshot = row.snapshot;
    return SubmissionRecordSchema.parse({ entryId: id, competitionId: row.competition_id,
      submittedAt: row.submitted_at.toISOString(), participant: snapshot.participant, work: snapshot.work,
      ageGroup: snapshot.ageGroup, consents: snapshot.consents,
      assets: snapshot.assets.map(asset => ({ id: asset.id, purpose: asset.purpose, displayName: asset.display_name,
        mediaType: asset.declared_type, sizeBytes: asset.size_bytes, pageCount: asset.page_count })),
    });
  });
}
