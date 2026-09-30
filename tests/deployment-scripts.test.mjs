import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

test('migration entrypoints refuse absent database', () => {
  for (const script of ['migrate.mjs', 'migrate-all.mjs', 'migrate-entries.mjs', 'database-check.mjs']) {
    const result = spawnSync(process.execPath, [`scripts/${script}`], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } });
    assert.equal(result.status, 1); assert.match(result.stderr, /DATABASE_URL must be configured/);
  }
});
test('deployment checks validate configuration without echoing credentials or connecting', () => {
  const env = { ...process.env, DATABASE_URL: 'postgresql://private:secret@unreachable.invalid/test',
    BETTER_AUTH_SECRET: 'a'.repeat(32), BETTER_AUTH_URL: 'https://gyca.example' };
  const valid = spawnSync(process.execPath, ['scripts/deployment-check.mjs'], { env, encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.doesNotMatch(valid.stdout + valid.stderr, /private:secret|unreachable/);
  const invalid = spawnSync(process.execPath, ['scripts/deployment-check.mjs'], {
    env: { ...env, BETTER_AUTH_URL: 'http://localhost:3000', BETTER_AUTH_SECRET: '' }, encoding: 'utf8' });
  assert.equal(invalid.status, 1); assert.match(invalid.stdout, /MISSING public_https_origin/);
  assert.match(invalid.stdout, /MISSING auth_secret/);
});
