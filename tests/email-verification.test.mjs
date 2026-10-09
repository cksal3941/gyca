import assert from 'node:assert/strict';
import test from 'node:test';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createEmailVerificationToken } from 'better-auth/api';
import { createVerificationEmail } from '../src/server/notifications/verification-email.ts';

test('verification email refuses missing configuration and binds links to the application', async () => {
  const sent = []; const mailer = { from: 'verify@example.org', send: async (payload, key) => { sent.push({ payload, key }); return 'ok'; } };
  const send = createVerificationEmail(mailer, 'https://gyca.test');
  const data = { user: { email: 'alice@example.org' }, token: 'fixture-token', url: 'https://gyca.test/api/auth/verify-email?token=fixture-token&callbackURL=https://evil.test' };
  await send(data); await send(data); assert.deepEqual(sent[0], sent[1]);
  assert.ok(sent[0].payload.text.includes('callbackURL=%2Flogin')); assert.equal(sent[0].payload.text.includes('evil.test'), false);
  await assert.rejects(send({ ...data, url: 'https://evil.test/api/auth/verify-email?token=fixture-token' }), { code: 'FORBIDDEN' });
  await assert.rejects(createVerificationEmail(null, 'https://gyca.test')(data), { code: 'POLICY_NOT_CONFIGURED' });
  await assert.rejects(createVerificationEmail({ ...mailer, send: async () => { throw new Error('mail unavailable'); } }, 'https://gyca.test')(data), /mail unavailable/);
});

test('installed Better Auth gates password sign-in until a valid verification link is used', async () => {
  const db = { user: [], session: [], account: [], verification: [] }; const emails = [];
  const send = createVerificationEmail({ from: 'verify@example.org', send: async payload => { emails.push(payload); return 'message'; } }, 'https://gyca.test');
  const auth = betterAuth({ database: memoryAdapter(db), baseURL: 'https://gyca.test', secret: 'test-only-secret-long-enough-for-auth-123456789',
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: { sendOnSignUp: true, sendOnSignIn: false, expiresIn: 3600, autoSignInAfterVerification: false, sendVerificationEmail: send },
    rateLimit: { enabled: false }, logger: { disabled: true } });
  const request = (path, body) => new Request(`https://gyca.test/api/auth/${path}`, { method: 'POST',
    headers: { origin: 'https://gyca.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const credentials = { email: 'alice@example.org', password: 'valid-password-123' };
  const signup = await auth.handler(request('sign-up/email', { ...credentials, name: 'Alice', emailVerified: true }));
  assert.equal(signup.status, 200); assert.equal(db.user[0].emailVerified, false); assert.equal(emails.length, 1);
  assert.equal((await auth.handler(request('sign-in/email', credentials))).status, 403);
  assert.equal((await auth.handler(request('send-verification-email', { email: credentials.email, callbackURL: '/login' }))).status, 200);
  assert.equal(emails.length, 2);
  const url = emails[0].text.split('\n').find(line => line.startsWith('https://'));
  const corrupted = new URL(url); corrupted.searchParams.set('token', 'forged');
  await auth.handler(new Request(corrupted)); assert.equal(db.user[0].emailVerified, false);
  const expired = new URL(url);
  expired.searchParams.set('token', await createEmailVerificationToken('test-only-secret-long-enough-for-auth-123456789', credentials.email, undefined, -1));
  await auth.handler(new Request(expired)); assert.equal(db.user[0].emailVerified, false);
  const verified = await auth.handler(new Request(url));
  assert.equal(verified.status, 302); assert.equal(db.user[0].emailVerified, true);
  assert.equal(verified.headers.get('set-cookie'), null);
  assert.equal((await auth.handler(request('sign-in/email', credentials))).status, 200);
});

test('database-backed verification resend limiter rejects excess HTTP requests', async () => {
  const db = { user: [], session: [], account: [], verification: [], rateLimit: [] };
  const auth = betterAuth({ database: memoryAdapter(db), baseURL: 'https://gyca.test', secret: 'test-only-secret-long-enough-for-auth-123456789',
    emailAndPassword: { enabled: true }, emailVerification: { sendVerificationEmail: async () => {} },
    rateLimit: { enabled: true, storage: 'database', customRules: { '/send-verification-email': { window: 60, max: 3 } } },
    logger: { disabled: true } });
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await auth.handler(new Request('https://gyca.test/api/auth/send-verification-email', {
    method: 'POST', headers: { origin: 'https://gyca.test', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' },
    body: JSON.stringify({ email: 'unknown@example.org' }),
  }))).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
});
