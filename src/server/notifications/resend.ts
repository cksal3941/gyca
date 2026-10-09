import { z } from "zod";
import { EntryFault } from "../entries/errors.ts";

export const ReceiptEmailSchema = z.strictObject({ from: z.email(), to: z.array(z.email()).length(1),
  subject: z.string().max(200), text: z.string().max(4000) }).readonly();
export type ReceiptEmail = z.infer<typeof ReceiptEmailSchema>;
export interface ReceiptMailer {
  readonly from: string;
  readonly send: (payload: ReceiptEmail, key: string) => Promise<string>;
}
export function configuredReceiptMailer(env: Readonly<Record<string, string | undefined>>): ReceiptMailer | null {
  const parsed = z.object({ key: z.string().regex(/^re_[A-Za-z0-9_]+$/), from: z.email() }).safeParse({ key: env.RESEND_API_KEY, from: env.RECEIPT_EMAIL_FROM });
  return env.GYCA_EMAIL_PROVIDER === "resend" && parsed.success ? createResendMailer(parsed.data) : null;
}
export function createResendMailer(config: { readonly key: string; readonly from: string }, transport: typeof fetch = fetch): ReceiptMailer {
  return { from: config.from, async send(payload, key) {
    try {
      const response = await transport("https://api.resend.com/emails", { method: "POST", redirect: "error",
        signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload) });
      if (!response.ok) { await response.body?.cancel(); throw new EntryFault("INTERNAL_ERROR", 503); }
      const reader = response.body?.getReader();
      if (reader === undefined) throw new EntryFault("INTERNAL_ERROR", 503);
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 16384) { await reader.cancel(); throw new EntryFault("INTERNAL_ERROR", 503); }
          chunks.push(chunk.value);
        }
      } finally { reader.releaseLock(); }
      return z.object({ id: z.string().min(1).max(200) }).parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))).id;
    } catch { throw new EntryFault("INTERNAL_ERROR", 503); }
  } };
}
