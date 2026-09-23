import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createAdminAccessHandler } from "./access.ts";

export const adminAccess = createAdminAccessHandler({
  database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
