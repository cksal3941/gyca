import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { inspectUpload } from "./inspect.ts";
import { createUploadService } from "./service.ts";
import { createUploadHandlers } from "./http.ts";
import { configuredS3Storage } from "./s3.ts";

// Storage is deliberately unavailable until a private, create-only provider is configured.
export const uploadHandlers = createUploadHandlers({
  service: createUploadService(database, configuredS3Storage(process.env), inspectUpload, () => new Date()),
  origin: process.env.BETTER_AUTH_URL, now: () => new Date(),
  getUserId: async (request) => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
