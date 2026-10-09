import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured. No migration was applied.');
  process.exitCode = 1;
} else {
  for (const script of ['migrate.mjs', 'migrate-entries.mjs']) {
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], {
        stdio: 'inherit', env: process.env, shell: false,
      });
      child.once('error', () => resolve(1));
      child.once('exit', code => resolve(code ?? 1));
    });
    if (code !== 0) { process.exitCode = 1; break; }
  }
}
