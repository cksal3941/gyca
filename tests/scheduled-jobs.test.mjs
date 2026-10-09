import assert from 'node:assert/strict';
import test from 'node:test';

test('scheduled runner bounds work and never forwards secrets to redirects or logs', async () => {
  const { runScheduledJobs } = await import('../scripts/lib/scheduled-jobs.mjs');
  const env = { BETTER_AUTH_URL: 'https://gyca.example', GYCA_JOB_KIND: 'payments', PAYMENT_RECOVERY_TOKEN: 's'.repeat(32), GYCA_JOB_LIMIT: '3' };
  const calls = [];
  const outcomes = ['completed', 'retry_scheduled', 'idle'];
  const result = await runScheduledJobs(env, async (url, token) => {
    calls.push({ url: url.toString(), token });
    return { status: 200, body: { data: { outcome: outcomes.shift() } } };
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://gyca.example/api/internal/payments/reconcile');
  assert.equal(calls[0].token, env.PAYMENT_RECOVERY_TOKEN);
  assert.deepEqual(result, { processed: 2, exhausted: false, stalled: false });
  assert.doesNotMatch(JSON.stringify(result), /ssss|https/);
  for (const overrides of [{ BETTER_AUTH_URL: 'http://gyca.example' }, { BETTER_AUTH_URL: 'https://user:secret@gyca.example' },
    { BETTER_AUTH_URL: 'https://gyca.example/path' }, { GYCA_JOB_KIND: 'unknown' }, { GYCA_JOB_LIMIT: '0' }, { GYCA_JOB_LIMIT: '21' }, { PAYMENT_RECOVERY_TOKEN: '' }]) {
    await assert.rejects(runScheduledJobs({ ...env, ...overrides }, async () => assert.fail('must not connect')));
  }
  for (const response of [{ status: 302, body: {} }, { status: 401, body: { secret: 'sensitive' } }, { status: 200, body: { data: { outcome: 'unknown' } } }])
    await assert.rejects(runScheduledJobs(env, async () => response), error => !error.message.includes('sensitive'));
  const capped = await runScheduledJobs(env, async () => ({ status: 200, body: { data: { outcome: 'completed' } } }));
  assert.equal(capped.processed, 3); assert.equal(capped.exhausted, true);
  const email = await runScheduledJobs({ ...env, GYCA_JOB_KIND: 'receipts', RECEIPT_EMAIL_TOKEN: 'e'.repeat(32), GYCA_JOB_LIMIT: '1' }, async (url, token) => {
    assert.equal(url.pathname, '/api/internal/notifications/receipts'); assert.equal(token, 'e'.repeat(32));
    return { status: 200, body: { data: { outcome: 'stalled' } } };
  });
  assert.equal(email.stalled, true);
  await runScheduledJobs({ ...env, GYCA_JOB_KIND: 'retention', RETENTION_JOB_TOKEN: 'r'.repeat(32), GYCA_JOB_LIMIT: '1' }, async (url, token) => {
    assert.equal(url.pathname, '/api/internal/storage/retention'); assert.equal(token, 'r'.repeat(32));
    return { status: 200, body: { data: { outcome: 'idle' } } };
  });
  await runScheduledJobs({ ...env, GYCA_JOB_KIND: 'blind-reviews', BLIND_REVIEW_JOB_TOKEN: 'b'.repeat(32), GYCA_JOB_LIMIT: '1' }, async (url, token) => {
    assert.equal(url.pathname, '/api/internal/storage/blind-reviews'); assert.equal(token, 'b'.repeat(32));
    return { status: 200, body: { data: { outcome: 'completed' } } };
  });
  await runScheduledJobs({ ...env, GYCA_JOB_KIND: 'certificates', CERTIFICATE_JOB_TOKEN: 'c'.repeat(32), GYCA_JOB_LIMIT: '1' }, async (url, token) => {
    assert.equal(url.pathname, '/api/internal/storage/certificates'); assert.equal(token, 'c'.repeat(32));
    return { status: 200, body: { data: { outcome: 'completed' } } };
  });
});
