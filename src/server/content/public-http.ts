import { randomUUID } from 'node:crypto';
import { EntryFault } from '../entries/errors.ts';

export function contentQuery(request: Request, allowed: readonly string[]) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (!allowed.includes(key) || params.getAll(key).length !== 1)
    throw new EntryFault('VALIDATION_FAILED', 422);
  return params;
}
export function createPublicContentRunner(now: () => Date) {
  return async (action: () => Promise<unknown>) => {
    const meta = { requestId: randomUUID(), serverTime: now().toISOString() };
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    try { return Response.json({ data: await action(), meta }, { headers }); }
    catch (error) {
      if (error instanceof EntryFault) return Response.json({ error: { code: error.code, message: error.code,
        retryable: false, fieldErrors: error.fieldErrors }, meta }, { status: error.status, headers });
      console.error('Public content request failed', { requestId: meta.requestId });
      return Response.json({ error: { code: 'INTERNAL_ERROR', message: 'Content could not be loaded', retryable: false, fieldErrors: [] }, meta },
        { status: 500, headers });
    }
  };
}
