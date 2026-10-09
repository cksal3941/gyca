import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPaymentAdmin } from "./admin.ts";
import { createPaymentAdminHandlers } from "./admin-http.ts";

export const paymentAdminHandlers = createPaymentAdminHandlers({
  service: createPaymentAdmin(database, () => new Date()),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
