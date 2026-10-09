import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { configuredTossProvider } from "./toss.ts";
import { createPaymentRefunds } from "./refunds.ts";
import { createRefundHandlers } from "./refund-http.ts";

const provider = configuredTossProvider(process.env);
export const refundHandlers = createRefundHandlers({
  service: createPaymentRefunds(database, provider === null ? [] : [provider], () => new Date()),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
