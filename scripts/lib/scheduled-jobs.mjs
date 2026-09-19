import { request } from 'node:https';
import { z } from 'zod';

const configSchema = z.object({
  BETTER_AUTH_URL: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  }),
  GYCA_JOB_KIND: z.enum(['payments', 'receipts', 'retention', 'blind-reviews', 'certificates']),
  GYCA_JOB_LIMIT: z.coerce.number().int().min(1).max(20).default(10),
});
const responseSchema = z.object({ data: z.object({ outcome: z.enum(['idle', 'completed', 'sent', 'retry_scheduled', 'stalled', 'superseded']) }) });
export class ScheduledJobError extends Error {
  constructor(message) { super(message); this.name = 'ScheduledJobError'; }
}

export function postJob(url, token) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new ScheduledJobError('Job request failed; inspect the server job state before retrying.'));
    const req = request(url, { method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': '2' } }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 8192) { response.destroy(); req.destroy(); fail(); return; }
        chunks.push(chunk);
      });
      response.on('error', fail);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch { fail(); }
      });
    });
    req.on('error', fail);
    req.end('{}');
  });
}

export async function runScheduledJobs(env, transport = postJob) {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) throw new ScheduledJobError('Invalid job configuration.');
  const config = parsed.data;
  const token = config.GYCA_JOB_KIND === 'payments' ? env.PAYMENT_RECOVERY_TOKEN
    : config.GYCA_JOB_KIND === 'receipts' ? env.RECEIPT_EMAIL_TOKEN
      : config.GYCA_JOB_KIND === 'retention' ? env.RETENTION_JOB_TOKEN
        : config.GYCA_JOB_KIND === 'blind-reviews' ? env.BLIND_REVIEW_JOB_TOKEN : env.CERTIFICATE_JOB_TOKEN;
  if (typeof token !== 'string' || !/^[\x21-\x7e]{32,512}$/.test(token)) throw new ScheduledJobError('Invalid job token configuration.');
  const path = config.GYCA_JOB_KIND === 'payments' ? '/api/internal/payments/reconcile'
    : config.GYCA_JOB_KIND === 'receipts' ? '/api/internal/notifications/receipts'
      : config.GYCA_JOB_KIND === 'retention' ? '/api/internal/storage/retention'
        : config.GYCA_JOB_KIND === 'blind-reviews' ? '/api/internal/storage/blind-reviews' : '/api/internal/storage/certificates';
  const url = new URL(path, config.BETTER_AUTH_URL);
  let processed = 0; let stalled = false;
  for (let i = 0; i < config.GYCA_JOB_LIMIT; i++) {
    const response = await transport(url, token);
    if (response.status !== 200) throw new ScheduledJobError('Job endpoint did not succeed.');
    const body = responseSchema.safeParse(response.body);
    if (!body.success) throw new ScheduledJobError('Unexpected job response.');
    if (body.data.data.outcome === 'idle') return { processed, exhausted: false, stalled };
    processed++;
    stalled ||= body.data.data.outcome === 'stalled';
  }
  return { processed, exhausted: true, stalled };
}
