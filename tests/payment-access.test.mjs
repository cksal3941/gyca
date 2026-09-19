import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadPlatformMigrations } from '../scripts/lib/platform-migrations.mjs';

test('payment access is competition scoped, audited and guarded by expected permission', async () => {
  const { managePaymentAccess } = await import('../scripts/lib/payment-access.mjs');
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
      INSERT INTO "user" VALUES('staff','staff@example.org',true)`);
    for (const migration of await loadPlatformMigrations()) await db.exec(migration.sql);
    await db.exec("INSERT INTO gyca_competitions(id,slug) VALUES('one','one'),('two','two')");
    const input = { userId: 'staff', expectedEmail: 'staff@example.org', competitionId: 'one',
      expectedPermission: null, permission: 'viewer', reason: 'Finance review', operatorReference: 'ticket-2' };
    const run = (value = input, apply = true) => db.transaction(tx => managePaymentAccess(tx, value, apply));
    await run(input, false);
    assert.equal((await db.query('SELECT * FROM gyca_payment_permissions')).rows.length, 0);
    await assert.rejects(run({ ...input, expectedEmail: 'other@example.org' }), /Account verification failed/);
    await assert.rejects(run({ ...input, competitionId: 'missing' }), /Competition not found/);
    await assert.rejects(run({ ...input, permission: 'admin' }), /Invalid payment access request/);
    await run();
    await assert.rejects(run(), /Permission changed/);
    await run({ ...input, expectedPermission: 'viewer', permission: 'operator' });
    assert.equal((await db.query("SELECT permission FROM gyca_payment_permissions WHERE competition_id='one'")).rows[0].permission, 'operator');
    assert.equal((await db.query("SELECT * FROM gyca_payment_permissions WHERE competition_id='two'")).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gyca_competition_editors')).rows.length, 0);
    await assert.rejects(db.exec('DELETE FROM gyca_payment_access_audit'), /immutable/i);
    await db.exec(`CREATE FUNCTION fail_payment_access_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER fail_payment_access_audit BEFORE INSERT ON gyca_payment_access_audit FOR EACH ROW EXECUTE FUNCTION fail_payment_access_audit()`);
    await assert.rejects(run({ ...input, expectedPermission: 'operator', permission: null }), /audit unavailable/);
    assert.equal((await db.query('SELECT * FROM gyca_payment_permissions')).rows.length, 1);
    await db.exec('DROP TRIGGER fail_payment_access_audit ON gyca_payment_access_audit');
    await db.exec('UPDATE "user" SET "emailVerified"=false');
    await assert.rejects(run({ ...input, expectedPermission: 'operator' }), /Account verification failed/);
    await run({ ...input, expectedPermission: 'operator', permission: null });
    assert.equal((await db.query('SELECT * FROM gyca_payment_permissions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM gyca_payment_access_audit')).rows.length, 3);
  } finally { await db.close(); }
});
