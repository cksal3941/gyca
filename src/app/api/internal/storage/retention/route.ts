import { database } from "@/server/database";
import { createRecoveryHandler } from "@/server/payments/recovery-http";
import { configuredS3RetentionStorage } from "@/server/uploads/s3";
import { createAssetRetentionWorker } from "@/server/uploads/retention-worker";

export const runtime = "nodejs";
const now = () => new Date();
export const POST = createRecoveryHandler({
  enabled: process.env.RETENTION_WORKER_ENABLED === "true",
  token: process.env.RETENTION_JOB_TOKEN,
  worker: createAssetRetentionWorker(database, configuredS3RetentionStorage(process.env), now),
});
