import { loadPlatformMigrations } from './lib/platform-migrations.mjs';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured. No migration was applied.');
  process.exitCode = 1;
} else {
  const migrations = await loadPlatformMigrations();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('gyca_migrations',0))");
    await client.query('CREATE TABLE IF NOT EXISTS gyca_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    for (const { name, sql, checksum } of migrations) {
      const existing = await client.query('SELECT checksum FROM gyca_migrations WHERE name=$1', [name]);
      if (existing.rows.length && existing.rows[0].checksum !== checksum) {
        console.error('Migration checksum changed. No migration was applied.');
        process.exitCode = 1;
        break;
      }
      if (!existing.rows.length) {
        await client.query(sql);
        await client.query('INSERT INTO gyca_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
      }
    }
    if (process.exitCode === 1) await client.query('ROLLBACK');
    else {
      await client.query('COMMIT');
      console.log('Platform migrations are current. No competition was opened.');
    }
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    if (!(error instanceof Error)) throw error;
    console.error('Entry migration failed. Check connectivity and run the auth migration first.');
    process.exitCode = 1;
  } finally {
    client?.release();
    await pool.end();
  }
}
