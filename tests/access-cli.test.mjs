import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('access CLIs reject unsafe invocation and malformed files before connecting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gyca-access-cli-'));
  try {
    const malformed = join(directory, 'malformed.json');
    const oversized = join(directory, 'oversized.json');
    await writeFile(malformed, '{"privateMarker":');
    await writeFile(oversized, 'x'.repeat(8193));
    for (const script of ['manage-organizer.mjs', 'manage-payment-access.mjs']) {
      const invoke = (args, database = 'postgresql://secret-user:secret-pass@unreachable.invalid/db') => spawnSync(process.execPath,
        [`scripts/${script}`, ...args], { encoding: 'utf8', timeout: 5000, env: { ...process.env, DATABASE_URL: database } });
      for (const [args, database] of [[[malformed], ''], [[malformed, '--unknown']], [[malformed, '--apply', 'extra']], [[malformed]], [[oversized]]]) {
        const result = database === undefined ? invoke(args) : invoke(args, database);
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1);
        assert.doesNotMatch(result.stdout + result.stderr, /secret-user|secret-pass|unreachable|privateMarker/);
        assert.doesNotMatch(result.stdout, /"applied":true/);
      }
    }
  } finally {
    await rm(join(directory, 'malformed.json'), { force: true });
    await rm(join(directory, 'oversized.json'), { force: true });
    await rmdir(directory);
  }
});
