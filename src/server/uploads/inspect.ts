import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { REJECTION_CODES } from "../../contracts/index.ts";
import { MAX_UPLOAD_BYTES } from "./policy.ts";

export const InspectionSchema = z.object({ state: z.enum(["ready", "rejected"]),
  rejectionCode: z.enum(REJECTION_CODES).nullable(), pageCount: z.number().int().nonnegative().nullable(),
  sizeBytes: z.number().int().nonnegative(), checksum: z.string().regex(/^[a-f0-9]{64}$/),
}).refine((v) => (v.state === "rejected") === (v.rejectionCode !== null)).readonly();
export type Inspection = z.infer<typeof InspectionSchema>;
export interface InspectionOptions {
  readonly mediaType: string;
  readonly maxBytes: number;
  readonly minPages: number | null;
}
export class InspectionUnavailable extends Error {
  readonly name = "InspectionUnavailable";
}
let activeInspections = 0;
export async function inspectUpload(bytes: Uint8Array, options: InspectionOptions): Promise<Inspection> {
  if (bytes.byteLength > Math.min(options.maxBytes, MAX_UPLOAD_BYTES)) return {
    state: "rejected", rejectionCode: "FILE_TOO_LARGE", pageCount: null, sizeBytes: bytes.byteLength,
    checksum: createHash("sha256").update(bytes).digest("hex"),
  };
  if (activeInspections >= 2) throw new InspectionUnavailable("File inspection capacity reached");
  activeInspections++;
  try { return await new Promise<Inspection>((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), "scripts/inspect-upload.mjs"), {
      workerData: { bytes, options }, resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new InspectionUnavailable("File inspection timed out"));
    }, 15000);
    worker.once("message", (message: unknown) => {
      clearTimeout(timer);
      const result = InspectionSchema.safeParse(message);
      void worker.terminate();
      if (result.success) resolve(result.data);
      else reject(new InspectionUnavailable("Invalid inspection response"));
    });
    worker.once("error", () => { clearTimeout(timer); reject(new InspectionUnavailable("File inspection worker failed")); });
    worker.once("exit", (code) => {
      clearTimeout(timer);
      reject(new InspectionUnavailable(`File inspection worker exited (${code})`));
    });
  }); } finally { activeInspections--; }
}
