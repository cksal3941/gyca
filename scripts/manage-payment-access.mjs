import { open } from 'node:fs/promises';
import { Pool } from 'pg';
import { managePaymentAccess, PaymentAccessError } from './lib/payment-access.mjs';

const [path, mode, ...extra] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !path || (mode !== undefined && mode !== '--apply') || extra.length) {
  console.error('Configure DATABASE_URL and run: node scripts/manage-payment-access.mjs request.json [--apply]');
  process.exitCode = 1;
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000,
    statement_timeout: 5000, query_timeout: 10000 });
  let client;
  try {
    const file = await open(path, 'r');
    let input;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 8192) throw new PaymentAccessError('Request must be a JSON file no larger than 8KiB.');
      input = JSON.parse(await file.readFile('utf8'));
    } finally { await file.close(); }
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await managePaymentAccess(client, input, mode === '--apply');
    await client.query(mode === '--apply' ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof PaymentAccessError ? error.message : 'Payment access operation failed. No success was confirmed; inspect database state before retrying.');
    process.exitCode = 1;
  } finally {
    client?.release(true);
    await pool.end();
  }
}
