import { presentationHandlers } from '@/server/content/competition-presentation-runtime';
export async function GET(request: Request) { return presentationHandlers.list(request); }
