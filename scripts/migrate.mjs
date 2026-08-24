// Better Auth DB 마이그레이션 (설치된 better-auth 버전 기준 스키마 적용)
// 사용법: node --env-file=.env.local scripts/migrate.mjs
import { getMigrations } from "better-auth/db/migration";
import { betterAuth } from "better-auth";
import { Pool } from "pg";

const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: { enabled: true },
});

const { toBeAdded, toBeCreated, runMigrations } = await getMigrations(
  auth.options,
);

if (!toBeAdded.length && !toBeCreated.length) {
  console.log("스키마가 이미 최신입니다.");
  process.exit(0);
}

for (const t of toBeCreated) console.log("생성:", t.table);
for (const t of toBeAdded) console.log("컬럼 추가:", t.table, Object.keys(t.fields));

await runMigrations();
console.log("마이그레이션 완료");
process.exit(0);
