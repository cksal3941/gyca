import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createWithdrawDraftHandler } from "./withdraw-draft.ts";
import { createWithdrawDraftReadinessHandler } from "./withdraw-draft-readiness.ts";

const dependencies = { database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
};
export const withdrawDraft = createWithdrawDraftHandler(dependencies);
export const withdrawDraftReadiness = createWithdrawDraftReadinessHandler(dependencies);
