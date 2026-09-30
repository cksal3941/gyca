import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = (await readdir(new URL('../tests/', import.meta.url)))
  .filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
if (tests.length === 0) {
  console.error('No backend tests found. Verification did not run.');
  process.exitCode = 1;
} else {
  const stages = [
    { name: 'Backend tests', args: ['--experimental-strip-types', '--test', '--test-concurrency=2', ...tests] },
    { name: 'Project type check', args: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'] },
    { name: 'Backend lint', args: ['node_modules/eslint/bin/eslint.js', 'src/lib/auth.ts', 'src/server', 'src/contracts', 'src/app/api/v1', 'src/app/api/internal', ...tests,
      'scripts/verify-backend.mjs', 'scripts/lib', 'scripts/database-check.mjs', 'scripts/storage-check.mjs', 'scripts/migrate-entries.mjs', 'scripts/run-scheduled-jobs.mjs', 'scripts/manage-organizer.mjs', 'scripts/manage-payment-access.mjs'] },
  ];
  for (const stage of stages) {
    console.log(`Running: ${stage.name}`);
    const status = await new Promise(resolve => {
      const child = spawn(process.execPath, stage.args, { cwd: root, stdio: 'inherit', shell: false });
      child.once('error', () => resolve(1));
      child.once('close', code => resolve(code ?? 1));
    });
    if (status !== 0) {
      console.error(`Failed: ${stage.name}. Remaining checks did not run.`);
      process.exitCode = 1;
      break;
    }
    console.log(`Passed: ${stage.name}`);
  }
  if (!process.exitCode) console.log('Backend verification passed. Live DB, cloud storage, email delivery and payment approval remain unverified.');
}
