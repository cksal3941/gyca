// Dev-only seed: one published, open Leipzig 2027 competition so the live
// frontend can list it and start a draft. NOT for production.
//
// Safety: this writes competition rows directly, so it refuses to run unless
//   1) DATABASE_URL is explicitly set,
//   2) GYCA_DEV_SEED=1 opts in (a deliberate confirmation), and
//   3) DATABASE_URL points at a local dev target (localhost / 127.0.0.1),
//   4) NODE_ENV is not "production".
// An arbitrary connection string never gets seeded automatically.
import { Pool } from 'pg';

const url = process.env.DATABASE_URL;
const isLocalTarget = /@(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//.test(url ?? '');
if (!url) {
  console.error('DATABASE_URL must be configured.');
  process.exit(1);
} else if (process.env.NODE_ENV === 'production') {
  console.error('Refusing: NODE_ENV=production. This dev seed must never run against production.');
  process.exit(1);
} else if (process.env.GYCA_DEV_SEED !== '1') {
  console.error('Refusing: set GYCA_DEV_SEED=1 to confirm you are seeding a DEV database.');
  process.exit(1);
} else if (!isLocalTarget) {
  console.error('Refusing: DATABASE_URL is not a local dev target (expected localhost/127.0.0.1). Refusing to seed a remote database.');
  process.exit(1);
}

const publicContent = {
  title: { en: 'Leipzig 2027', ko: '라이프치히 2027' },
  fee: { currency: 'EUR', amountMinor: 7000 },
  timezone: 'Europe/Berlin',
  keyDates: [],
  exhibition: null,
  guidelines: null,
  formSpec: {
    version: 'dev-seed',
    ageReferenceDate: '2027-01-01',
    categories: [],
    ageGroups: [],
    fields: [],
    uploads: [],
  },
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await pool.query(
    `INSERT INTO gyca_competitions(id,slug,published,draft_enabled,opens_at,closes_at,public_content)
     VALUES ('leipzig-2027','leipzig-2027',true,true,'2026-01-01T00:00:00Z','2027-12-31T00:00:00Z',$1::jsonb)
     ON CONFLICT (id) DO UPDATE SET published=true, draft_enabled=true,
       opens_at=EXCLUDED.opens_at, closes_at=EXCLUDED.closes_at, public_content=EXCLUDED.public_content`,
    [JSON.stringify(publicContent)],
  );
  const check = await pool.query('SELECT id,slug,published,draft_enabled,phase,opens_at,closes_at FROM gyca_competitions WHERE slug=$1', ['leipzig-2027']);
  console.log('Seeded competition:', check.rows[0]);
} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
