import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPaymentPolicyHandlers } from "./payment-policy-admin.ts";

export const paymentPolicyHandlers = createPaymentPolicyHandlers({ database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
