import { privacyRequestHandlers } from "@/server/privacy/runtime";

export async function GET(request: Request) { return privacyRequestHandlers.list(request); }
export async function POST(request: Request) { return privacyRequestHandlers.create(request); }
