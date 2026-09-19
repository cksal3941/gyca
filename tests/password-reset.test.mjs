import assert from 'node:assert/strict';
import test from 'node:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';

test('password reset uses a fixed app link, single-use token and revokes existing sessions', async () => {
  const { createPasswordResetEmail } = await import('../src/server/notifications/password-reset-email.ts');
  const messages = [];
  const send = createPasswordResetEmail({ from: 'account@example.org', send: async (payload, key) => { messages.push({ payload, key }); return 'id'; } }, 'https://gyca.test');
  const db = { user: [], session: [], account: [], verification: [] };
  const auth = betterAuth({ database: memoryAdapter(db), baseURL: 'https://gyca.test', secret: 'password-reset-test-secret-long-enough-12345',
    emailAndPassword: { enabled: true, minPasswordLength: 8, resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true, sendResetPassword: send }, rateLimit: { enabled: false }, logger: { disabled: true } });
  const request = (path, body) => auth.handler(new Request(`https://gyca.test/api/auth/${path}`, {
    method: 'POST', headers: { origin: 'https://gyca.test', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  const credentials = { email: 'artist@example.org', password: 'old-password-123' };
  assert.equal((await request('sign-up/email', { ...credentials, name: 'Artist' })).status, 200);
  assert.ok(db.session.length > 0);
  const known = await request('request-password-reset', { email: credentials.email, redirectTo: '/unexpected-page' });
  const unknown = await request('request-password-reset', { email: 'missing@example.org' });
  assert.deepEqual(await known.json(), await unknown.json());
  assert.equal(messages.length, 1);
  const link = new URL(messages[0].payload.text.match(/https:\/\/\S+/)[0]);
  assert.equal(link.pathname, '/reset-password'); assert.equal(link.search, '');
  const token = link.hash.slice(1);
  assert.ok(token.length >= 20);
  assert.doesNotMatch(messages[0].key, new RegExp(token));
  assert.equal((await request('reset-password', { token, newPassword: 'short' })).status, 400);
  assert.equal((await request('reset-password', { token, newPassword: 'new-password-123' })).status, 200);
  assert.equal(db.session.length, 0);
  assert.equal((await request('reset-password', { token, newPassword: 'replay-password' })).status, 400);
  assert.equal((await request('sign-in/email', credentials)).status, 401);
  assert.equal((await request('sign-in/email', { ...credentials, password: 'new-password-123' })).status, 200);
  await request('request-password-reset', { email: credentials.email });
  const expiredToken = new URL(messages[1].payload.text.match(/https:\/\/\S+/)[0]).hash.slice(1);
  db.verification.find(row => row.identifier === `reset-password:${expiredToken}`).expiresAt = new Date(0);
  assert.equal((await request('reset-password', { token: expiredToken, newPassword: 'expired-password' })).status, 400);
  await assert.rejects(createPasswordResetEmail(null, 'https://gyca.test')({ user: { email: credentials.email }, token }), { code: 'POLICY_NOT_CONFIGURED' });
  await assert.rejects(createPasswordResetEmail({ from: 'account@example.org', send: async () => assert.fail() }, 'http://gyca.test')({ user: { email: credentials.email }, token }), { code: 'POLICY_NOT_CONFIGURED' });
});
