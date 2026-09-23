import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createEntryExport } from "./export.ts";
import { createEntryExportHandler } from "./export-http.ts";

export const entryExportHandler = createEntryExportHandler({
  service: createEntryExport(database, () => new Date()), origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
