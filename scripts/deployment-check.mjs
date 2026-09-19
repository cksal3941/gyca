import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Read-only local checks. No network requests and no environment values are printed.
const root = process.cwd();
const require = createRequire(resolve(root, 'package.json'));
const checks = [];
const check = (name, ready) => checks.push({ name, ready });
check('node_24_or_newer', Number(process.versions.node.split('.')[0]) >= 24);
let database = false;
try { const url = new URL(process.env.DATABASE_URL ?? ''); database = ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.hostname && url.pathname.length > 1); } catch { /* Invalid or missing local configuration. */ }
check('database_url', database);
check('auth_secret', (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32);
let origin = false;
try { const url = new URL(process.env.BETTER_AUTH_URL ?? ''); origin = url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash; } catch { /* Invalid or missing local configuration. */ }
check('public_https_origin', origin);
check('upload_inspection_script', existsSync(resolve(root, 'scripts/inspect-upload.mjs')));
check('public_assets', existsSync(resolve(root, 'public')));
for (const dependency of ['pg', 'pdf-lib', 'sharp']) {
  let ready = false;
  try { require(dependency); ready = true; } catch { /* Missing or incompatible runtime dependency. */ }
  check(`runtime_${dependency}`, ready);
}
for (const result of checks) console.log(`${result.ready ? 'PASS' : 'MISSING'} ${result.name}`);
console.log('Scope: local web runtime only. DB connectivity, migrations, S3, PG and opening readiness are not verified.');
if (checks.some(result => !result.ready)) process.exitCode = 1;
