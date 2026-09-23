import { editorialPublicHandlers } from "@/server/content/editorial-runtime";
export async function GET(request: Request) { return editorialPublicHandlers.list(request); }
