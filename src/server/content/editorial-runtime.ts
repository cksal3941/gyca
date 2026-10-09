import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createEditorialService } from "./editorial.ts";
import { createEditorialHandlers, createEditorialPublicHandlers } from "./editorial-http.ts";

const now = () => new Date(); const service = createEditorialService(database, now);
export const editorialAdminHandlers = createEditorialHandlers({ service, now, origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => { const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null; } });
export const editorialPublicHandlers = createEditorialPublicHandlers(service, now);
