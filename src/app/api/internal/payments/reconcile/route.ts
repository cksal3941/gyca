import { database } from "@/server/database";
import { configuredTossProvider } from "@/server/payments/toss";
import { createPaymentService } from "@/server/payments/service";
import { createPaymentRecovery } from "@/server/payments/recovery";
import { createRecoveryHandler } from "@/server/payments/recovery-http";

export const runtime = "nodejs";
const provider = configuredTossProvider(process.env);
const now = () => new Date();
export const POST = createRecoveryHandler({ enabled: process.env.PAYMENT_RECOVERY_ENABLED === "true",
  token: process.env.PAYMENT_RECOVERY_TOKEN,
  worker: createPaymentRecovery(database, provider, createPaymentService(database, provider, now), now),
});
