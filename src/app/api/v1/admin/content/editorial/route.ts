import { editorialAdminHandlers } from "@/server/content/editorial-runtime";
export async function GET(request: Request) { return editorialAdminHandlers.listAdmin(request); }
export async function POST(request: Request) { return editorialAdminHandlers.create(request); }
