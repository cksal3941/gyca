import { paymentHandlers } from "@/server/payments/runtime";

export const runtime = "nodejs";
export const GET = paymentHandlers.list;
