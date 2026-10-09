import { z } from "zod";
import { SubmissionDownloadSchema } from "../../contracts/submission-download.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import type { UploadStorage } from "./storage.ts";

export function createSubmissionDownloadHandler(deps: {
  readonly database: EntryDatabase; readonly storage: UploadStorage | null;
  readonly getUserId: (request: Request) => Promise<string | null>;
  readonly origin: string | undefined; readonly now: () => Date;
}) {
  const run = createAuthenticatedRunner(deps);
  return (request: Request, entryId: string, assetId: string) => run(request, true, 200, async owner => {
    const entry = parseRequest(z.uuid(), entryId); const asset = parseRequest(z.uuid(), assetId);
    const raw = (await deps.database.query(`SELECT s.snapshot->'assets' AS assets
      FROM gyca_submissions s JOIN gyca_entries e ON e.id=s.entry_id WHERE e.id=$1 AND e.owner_id=$2`, [entry, owner])).rows[0];
    if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
    const row = z.object({ assets: z.array(z.object({ id: z.uuid(), object_key: z.string(),
      object_version: z.string().nullable(), state: z.string() })) }).parse(raw);
    const saved = row.assets.find(item => item.id === asset);
    if (!saved) throw new EntryFault("NOT_FOUND", 404);
    const current = (await deps.database.query("SELECT removed_at FROM gyca_assets WHERE id=$1 AND entry_id=$2", [asset, entry])).rows[0];
    if (!current || z.object({ removed_at: z.date().nullable() }).parse(current).removed_at !== null) throw new EntryFault("FILE_NOT_READY", 409);
    if (saved.state !== "ready" || !saved.object_version || saved.object_version === "null") throw new EntryFault("FILE_NOT_READY", 409);
    if (!deps.storage?.signDownload) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
    return SubmissionDownloadSchema.parse(await deps.storage.signDownload({ key: saved.object_key, version: saved.object_version }));
  });
}
