import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createGuardianAdminHandler } from "./guardian-admin.ts";
import { createGuardianVerificationService } from "./guardian-verification.ts";
import { createGuardianVerificationHandler } from "./guardian-verification-http.ts";

export const guardianAdminHandler = createGuardianAdminHandler({ database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});

export const guardianVerificationHandler = createGuardianVerificationHandler({
  service: createGuardianVerificationService(database, () => new Date()),
  now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
