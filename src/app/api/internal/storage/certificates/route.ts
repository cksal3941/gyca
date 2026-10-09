import { database } from "@/server/database";
import { createCertificateWorker } from "@/server/certificates/worker";
import { createRecoveryHandler } from "@/server/payments/recovery-http";
import { configuredS3Storage } from "@/server/uploads/s3";

export const runtime = "nodejs";
const now = () => new Date();
export const POST = createRecoveryHandler({ enabled: process.env.CERTIFICATE_WORKER_ENABLED === "true",
  token: process.env.CERTIFICATE_JOB_TOKEN,
  worker: createCertificateWorker(database, configuredS3Storage(process.env), now) });
