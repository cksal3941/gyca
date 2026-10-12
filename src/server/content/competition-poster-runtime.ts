import 'server-only';
import { auth } from '@/lib/auth';
import { database } from '../database.ts';
import { createPosterService } from './competition-poster.ts';
import { createPosterHandlers } from './competition-poster-http.ts';

const now = () => new Date();
export const posterHandlers = createPosterHandlers({ service: createPosterService(database, now), now,
  origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => (await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }))?.user.id ?? null });
