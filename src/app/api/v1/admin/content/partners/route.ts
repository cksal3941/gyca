import { partnerAdminHandlers } from "@/server/content/partners-runtime";
export async function GET(request: Request) { return partnerAdminHandlers.listAdmin(request); }
export async function POST(request: Request) { return partnerAdminHandlers.create(request); }
