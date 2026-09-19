import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createEntryRepository } from "./repository.ts";
import { createEntryHandlers } from "./http.ts";

export const entryHandlers = createEntryHandlers({
  repository: createEntryRepository(database, () => new Date()),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
