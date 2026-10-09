import { getMigrations } from 'better-auth/db/migration';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured. No auth migration was applied.');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const auth = betterAuth({ database: pool, emailAndPassword: { enabled: true }, rateLimit: { enabled: true, storage: 'database' } });
    const { runMigrations } = await getMigrations(auth.options);
    await runMigrations();
    console.log('Auth schema is current.');
  } catch {
    console.error('Auth migration failed. Check the database connection and migration permissions.');
    process.exitCode = 1;
  } finally { await pool.end(); }
}
