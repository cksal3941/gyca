const authColumns = { user: ['id', 'email', 'emailVerified'], session: ['id', 'userId', 'expiresAt'],
  account: ['id', 'userId', 'providerId', 'accountId'], verification: ['id', 'identifier', 'value', 'expiresAt'],
  rateLimit: ['key', 'count', 'lastRequest'] };

export async function checkDatabase(db, migrations) {
  await db.query('SET TRANSACTION READ ONLY');
  await db.query("SET LOCAL statement_timeout='5s'");
  const checks = [];
  const tables = [...new Set(migrations.flatMap(m => [...m.sql.matchAll(/CREATE TABLE (gyca_[a-z_]+)\s*\(/g)].map(match => match[1])))];
  const relations = (await db.query(`SELECT name,to_regclass(quote_ident(name)) IS NOT NULL AS present
    FROM unnest($1::text[]) AS name`, [['gyca_migrations', ...tables]])).rows;
  checks.push({ name: 'platform_tables', ready: tables.length > 0 && relations.filter(row => row.name !== 'gyca_migrations').every(row => row.present) });
  const historyPresent = relations.find(row => row.name === 'gyca_migrations')?.present === true;
  let historyMatches = false;
  if (historyPresent) {
    const rows = (await db.query('SELECT name,checksum FROM gyca_migrations')).rows;
    historyMatches = rows.length === migrations.length && migrations.every(m => rows.some(row => row.name === m.name && row.checksum === m.checksum));
  }
  checks.push({ name: 'migration_history', ready: historyMatches });
  let authReady = true;
  for (const [table, expected] of Object.entries(authColumns)) {
    const columns = (await db.query(`SELECT attname FROM pg_attribute WHERE attrelid=to_regclass(quote_ident($1))
      AND attnum>0 AND NOT attisdropped`, [table])).rows;
    authReady &&= expected.every(name => columns.some(column => column.attname === name));
  }
  checks.push({ name: 'auth_columns', ready: authReady });
  return { ready: checks.every(check => check.ready), checks };
}
