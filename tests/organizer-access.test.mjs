import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('organizer access requires exact verified account and atomically records changes', async () => {
  const { manageOrganizerAccess } = await import('../scripts/lib/organizer-access.mjs');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      INSERT INTO "user" VALUES('operator','owner@example.org',true),('unverified','unverified@example.org',false)`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    const input = { userId: 'operator', expectedEmail: 'owner@example.org', expectedGranted: false, grant: true,
      reason: 'Initial organizer setup', operatorReference: 'internal-ticket-1' };
    const run = (value = input, apply = true) => db.transaction(tx => manageOrganizerAccess(tx, value, apply));
    assert.equal((await run(input, false)).applied, false);
    assert.equal((await db.query('SELECT * FROM gyca_competition_editors')).rows.length, 0);
    await assert.rejects(run({ ...input, expectedEmail: 'wrong@example.org' }), /Account verification failed/);
    await assert.rejects(run({ ...input, userId: 'unverified', expectedEmail: 'unverified@example.org' }), /Account verification failed/);
    await assert.rejects(run({ ...input, userId: 'missing' }), /Account verification failed/);
    assert.equal((await run()).applied, true);
    assert.equal((await db.query('SELECT * FROM gyca_competition_editors')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM gyca_organizer_access_audit')).rows.length, 1);
    await assert.rejects(run(), /Permission changed/);
    await assert.rejects(db.exec('DELETE FROM gyca_organizer_access_audit'), /immutable/i);
    await db.exec(`CREATE FUNCTION fail_access_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_access_audit BEFORE INSERT ON gyca_organizer_access_audit FOR EACH ROW EXECUTE FUNCTION fail_access_audit()`);
    await assert.rejects(run({ ...input, expectedGranted: true, grant: false }), /audit unavailable/);
    assert.equal((await db.query('SELECT * FROM gyca_competition_editors')).rows.length, 1);
    await db.exec('DROP TRIGGER fail_access_audit ON gyca_organizer_access_audit');
    await db.exec('UPDATE "user" SET "emailVerified"=false');
    await run({ ...input, expectedGranted: true, grant: false });
    assert.equal((await db.query('SELECT * FROM gyca_competition_editors')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gyca_organizer_access_audit')).rows.length, 2);
    assert.equal((await db.query('SELECT * FROM gyca_payment_permissions')).rows.length, 0);
  } finally { await db.close(); }
});
