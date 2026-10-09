import 'server-only';
import { auth } from '@/lib/auth';
import { database } from '../database.ts';
import { createPresentationService } from './competition-presentation.ts';
import { createPresentationHandlers } from './competition-presentation-http.ts';

const now = () => new Date();
export const presentationHandlers = createPresentationHandlers({ service: createPresentationService(database, now), now,
  origin: process.env.BETTER_AUTH_URL,
  getUserId: async request => (await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } }))?.user.id ?? null });
