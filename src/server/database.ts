import "server-only";
import { Pool } from "pg";
import type { EntryDatabase } from "./entries/database.ts";
import { EntryFault } from "./entries/errors.ts";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
function configured() {
  if (!process.env.DATABASE_URL) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
}
export const database: EntryDatabase = {
  async query(sql, values) {
    configured();
    return pool.query(sql, values === undefined ? undefined : [...values]);
  },
  async transaction(run) {
    configured();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run({ query: (sql, values) => client.query(sql, values === undefined ? undefined : [...values]) });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  },
};
