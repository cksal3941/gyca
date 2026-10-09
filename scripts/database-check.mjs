import { Pool } from 'pg';
import { checkDatabase } from './lib/database-check.mjs';
import { loadPlatformMigrations } from './lib/platform-migrations.mjs';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured. No database check was run.');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000,
    statement_timeout: 5000, query_timeout: 10000 });
  let client;
  try {
    const migrations = await loadPlatformMigrations();
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const result = await checkDatabase(client, migrations);
    await client.query('ROLLBACK');
    for (const check of result.checks) console.log(`${check.ready ? 'PASS' : 'MISSING'} ${check.name}`);
    console.log('Scope: database connectivity, migration history and selected schema checks. Opening readiness is not verified.');
    if (!result.ready) process.exitCode = 1;
  } catch {
    console.error('Database check failed. Check connectivity, permissions and schema using administrator tools.');
    process.exitCode = 1;
  } finally {
    client?.release(true);
    await pool.end();
  }
}
