import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('database check detects missing schema and migration drift without changing records', async () => {
  const { checkDatabase } = await import('../scripts/lib/database-check.mjs');
  const { loadPlatformMigrations } = await import('../scripts/lib/platform-migrations.mjs');
  const db = new PGlite();
  try {
    const migrations = await loadPlatformMigrations();
    const inspect = () => db.transaction(tx => checkDatabase(tx, migrations));
    const empty = await inspect();
    assert.equal(empty.ready, false);
    assert.equal(empty.checks.find(c => c.name === 'migration_history').ready, false);
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      CREATE TABLE session(id text,"userId" text,"expiresAt" timestamptz);
      CREATE TABLE account(id text,"userId" text,"providerId" text,"accountId" text);
      CREATE TABLE verification(id text,identifier text,value text,"expiresAt" timestamptz);
      CREATE TABLE "rateLimit"(key text,count integer,"lastRequest" bigint);
      CREATE TABLE gyca_migrations(name text PRIMARY KEY,checksum text)`);
    for (const migration of migrations) {
      await db.exec(migration.sql);
      await db.query('INSERT INTO gyca_migrations VALUES($1,$2)', [migration.name, migration.checksum]);
    }
    assert.equal((await inspect()).ready, true);
    await assert.rejects(db.transaction(async tx => {
      await checkDatabase(tx, migrations);
      await tx.query("INSERT INTO gyca_competitions(id,slug) VALUES('forbidden','forbidden')");
    }), /read-only/);
    await db.query("UPDATE gyca_migrations SET checksum='changed' WHERE name=$1", [migrations[0].name]);
    assert.equal((await inspect()).ready, false);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM gyca_competitions')).rows[0].n, 0);
    await db.query('UPDATE gyca_migrations SET checksum=$2 WHERE name=$1', [migrations[0].name, migrations[0].checksum]);
    await db.exec('ALTER TABLE "user" DROP COLUMN "emailVerified"');
    assert.equal((await inspect()).checks.find(c => c.name === 'auth_columns').ready, false);
    await db.exec('ALTER TABLE "user" ADD COLUMN "emailVerified" boolean; DROP TABLE gyca_guardian_consents');
    assert.equal((await inspect()).checks.find(c => c.name === 'platform_tables').ready, false);
  } finally { await db.close(); }
});
