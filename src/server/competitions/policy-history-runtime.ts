import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPolicyHistoryHandler } from "./policy-history.ts";

const dependencies = { database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request: Request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
};
export const submissionPolicyHistory = createPolicyHistoryHandler({ ...dependencies, kind: "submission" });
export const paymentPolicyHistory = createPolicyHistoryHandler({ ...dependencies, kind: "payment" });
