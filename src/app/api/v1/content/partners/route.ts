import { partnerPublicHandlers } from "@/server/content/partners-runtime";
export async function GET(request: Request) { return partnerPublicHandlers.list(request); }
