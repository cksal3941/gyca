import "server-only";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { createAuthenticatedRunner, parseRequest } from "../entries/http.ts";
import { configuredTossProvider } from "../payments/toss.ts";
import { createLaunchReadiness } from "./launch-readiness.ts";
import { createLaunchControl } from "./launch-control.ts";
import { createLaunchControlHandlers } from "./launch-control-http.ts";
import { configuredS3Storage } from "../uploads/s3.ts";

const provider = configuredTossProvider(process.env);
const assess = createLaunchReadiness(database, { providers: provider === null ? [] : [provider], now: () => new Date(),
  storageConfigured: configuredS3Storage(process.env) !== null, guardianVerificationConfigured: true });
const run = createAuthenticatedRunner({ origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
export const launchReadinessHandler = (request: Request, id: string) => run(request, false, 200,
  actor => assess(actor, parseRequest(z.string().min(1).max(128), id)));
export const launchControlHandlers = createLaunchControlHandlers({ service: createLaunchControl(database, () => new Date(), assess),
  origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
