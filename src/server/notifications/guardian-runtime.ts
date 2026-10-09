import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { configuredReceiptMailer } from "./resend.ts";
import { createGuardianConsent } from "./guardian-consent.ts";
import { createGuardianHandlers } from "./guardian-http.ts";

export const guardianHandlers = createGuardianHandlers({ enabled: process.env.GYCA_GUARDIAN_CONSENT_ENABLED === "true",
  service: createGuardianConsent(database, { mailer: configuredReceiptMailer(process.env), origin: process.env.BETTER_AUTH_URL, now: () => new Date() }),
  origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
