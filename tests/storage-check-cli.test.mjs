import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

test('storage preflight CLI fails without configuration and never echoes supplied credentials or arguments', () => {
  const env = { ...process.env, GYCA_STORAGE_PROVIDER: 'disabled', GYCA_S3_SECRET_ACCESS_KEY: 'PRIVATE_FIXTURE_SECRET' };
  for (const args of [[], ['PRIVATE_ARGUMENT']]) {
    const result = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/storage-check.mjs', ...args], {
      env, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_FIXTURE_SECRET|PRIVATE_ARGUMENT|PASS bucket/);
    assert.match(result.stdout, /remain unverified/);
  }
});
