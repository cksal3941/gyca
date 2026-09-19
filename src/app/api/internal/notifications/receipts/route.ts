import { database } from "@/server/database";
import { configuredReceiptMailer } from "@/server/notifications/resend";
import { createReceiptWorker } from "@/server/notifications/receipt-worker";
import { createRecoveryHandler } from "@/server/payments/recovery-http";

export const runtime = "nodejs";
export const POST = createRecoveryHandler({ enabled: process.env.RECEIPT_EMAIL_ENABLED === "true", token: process.env.RECEIPT_EMAIL_TOKEN,
  worker: createReceiptWorker(database, configuredReceiptMailer(process.env), () => new Date()) });
