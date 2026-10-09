import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createPauseApplicationsHandler } from "./pause-applications.ts";
import { createResumeApplicationsHandler } from "./resume-applications.ts";

export const pauseApplicationsHandler = createPauseApplicationsHandler({ database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});

export const resumeApplicationsHandler = createResumeApplicationsHandler({ database, now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
