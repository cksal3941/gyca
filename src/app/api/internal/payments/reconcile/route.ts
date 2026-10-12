import { database } from "@/server/database";
import { configuredTossProviders } from "@/server/payments/toss";
import { createPaymentService } from "@/server/payments/service";
import { createPaymentRecovery } from "@/server/payments/recovery";
import { createRecoveryHandler } from "@/server/payments/recovery-http";

export const runtime = "nodejs";
const providers = configuredTossProviders(process.env);
const now = () => new Date();
const service = createPaymentService(database, providers, now);
// One recovery queue per merchant account; a single invocation serves the first account with due work.
const workers = providers.map((provider) => createPaymentRecovery(database, provider, service, now));
const worker = {
  async runOnce() {
    if (workers.length === 0) return createPaymentRecovery(database, null, service, now).runOnce();
    for (const candidate of workers) {
      const result = await candidate.runOnce();
      if (result.outcome !== "idle") return result;
    }
    return { outcome: "idle" as const };
  },
};
export const POST = createRecoveryHandler({ enabled: process.env.PAYMENT_RECOVERY_ENABLED === "true",
  token: process.env.PAYMENT_RECOVERY_TOKEN, worker });
