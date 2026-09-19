import { competitionAdminHandlers } from "@/server/competitions/admin-runtime";
export const GET = competitionAdminHandlers.list;
export const POST = competitionAdminHandlers.create;
