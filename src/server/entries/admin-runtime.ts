import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createAdminEntriesHandler } from "./admin.ts";
import { createAdminEntryDetailHandler } from "./admin-detail.ts";

const dependencies = { database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
};
export const adminEntriesHandler = createAdminEntriesHandler(dependencies);
export const adminEntryDetailHandler = createAdminEntryDetailHandler(dependencies);
