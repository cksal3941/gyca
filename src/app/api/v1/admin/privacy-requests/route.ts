import { privacyRequestHandlers } from "@/server/privacy/runtime";

export async function GET(request: Request) { return privacyRequestHandlers.listAdmin(request); }
