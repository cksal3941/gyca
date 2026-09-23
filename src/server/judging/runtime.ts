import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { configuredS3BlindStorage, configuredS3Storage } from "../uploads/s3.ts";
import { createJudgingHandlers } from "./http.ts";
import { createJudgingService } from "./service.ts";

const now = () => new Date();
export const judgingHandlers = createJudgingHandlers({ service: createJudgingService(database,
  configuredS3BlindStorage(process.env) ?? configuredS3Storage(process.env), now),
  now, origin: process.env.BETTER_AUTH_URL, getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  } });
