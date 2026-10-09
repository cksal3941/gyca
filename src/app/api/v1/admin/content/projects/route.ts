import { archiveAdminHandlers } from '@/server/content/archives-runtime';
export async function GET(request: Request) { return archiveAdminHandlers.listAdmin(request); }
export async function POST(request: Request) { return archiveAdminHandlers.create(request); }
