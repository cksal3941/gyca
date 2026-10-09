import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createCompetitionAdmin } from "./admin.ts";
import { createCompetitionAdminHandlers } from "./admin-http.ts";
import { createRetentionPolicyHandlers } from "./retention-policy-admin.ts";

export const competitionAdminHandlers = createCompetitionAdminHandlers({
  service: createCompetitionAdmin(database, () => new Date()), now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});

export const retentionPolicyHandlers = createRetentionPolicyHandlers({ database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
