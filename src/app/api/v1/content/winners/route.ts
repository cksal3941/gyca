import { archivePublicHandlers } from '@/server/content/archives-runtime';
export async function GET(request: Request) { return archivePublicHandlers.list(request, 'selection'); }
