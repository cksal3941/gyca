import { database } from "@/server/database";
import { createBlindAssetWorker } from "@/server/judging/blind-worker";
import { createRecoveryHandler } from "@/server/payments/recovery-http";
import { configuredS3BlindStorage } from "@/server/uploads/s3";

export const runtime = "nodejs";
const now = () => new Date();
export const POST = createRecoveryHandler({ enabled: process.env.BLIND_REVIEW_WORKER_ENABLED === "true",
  token: process.env.BLIND_REVIEW_JOB_TOKEN,
  worker: createBlindAssetWorker(database, configuredS3BlindStorage(process.env), now) });
