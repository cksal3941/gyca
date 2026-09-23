import 'server-only';
import { auth } from '@/lib/auth';
import { database } from '../database.ts';
import { createArchiveService } from './archives.ts';
import { createArchiveHandlers, createArchivePublicHandlers } from './archives-http.ts';

const now = () => new Date();
const service = createArchiveService(database, now);
export const archiveAdminHandlers = createArchiveHandlers({ service, now, origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => (await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }))?.user.id ?? null });
export const archivePublicHandlers = createArchivePublicHandlers(service, now);
