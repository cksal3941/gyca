import "server-only";
import { auth } from "@/lib/auth";
import { database } from "../database.ts";
import { configuredS3Storage } from "../uploads/s3.ts";
import { createCertificateHandlers } from "./service.ts";

export const certificateHandlers = createCertificateHandlers({
  database, storage: configuredS3Storage(process.env), now: () => new Date(), origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => {
    const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
    return session?.user.id ?? null;
  },
});
