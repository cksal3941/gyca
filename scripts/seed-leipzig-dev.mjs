// Dev-only seed: one published, open Leipzig 2027 competition so the live
// frontend can list it and start a draft. NOT for production.
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL must be configured.');
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
