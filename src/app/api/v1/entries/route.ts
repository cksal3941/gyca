import { entryHandlers } from "@/server/entries/runtime";

export const runtime = "nodejs";
export const GET = entryHandlers.list;
export const POST = entryHandlers.create;
