import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPrivacyRequestHandlers } from "./http.ts";
import { createPrivacyRequestService } from "./service.ts";

const now = () => new Date();
export const privacyRequestHandlers = createPrivacyRequestHandlers({
  service: createPrivacyRequestService(database, now), now, origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
