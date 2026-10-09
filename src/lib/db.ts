import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";

// dev의 HMR로 모듈이 재로드될 때마다 커넥션 풀이 새로 생기지 않도록
// globalThis에 캐시한다.
const globalForDb = globalThis as unknown as { __gycaPool?: Pool };

export const pool =
  globalForDb.__gycaPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__gycaPool = pool;
}

export const db = drizzle(pool, { schema });
