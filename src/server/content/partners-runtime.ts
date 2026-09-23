import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPartnerHandlers, createPartnerPublicHandlers } from "./partners-http.ts";
import { createPartnerService } from "./partners.ts";

const now = () => new Date(); const service = createPartnerService(database, now);
export const partnerAdminHandlers = createPartnerHandlers({ service, now, origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => { const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null; } });
export const partnerPublicHandlers = createPartnerPublicHandlers(service, now);
