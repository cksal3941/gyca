// 이메일로 유저를 찾아 admin 역할을 부여한다.
// 사용법: pnpm set-admin <email>   (또는 node --env-file=.env.local scripts/set-admin.mjs <email>)
import { Pool } from "pg";

const email = process.argv[2];
if (!email) {
  console.error("사용법: pnpm set-admin <email>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rowCount } = await pool.query(
  `UPDATE "user" SET role = 'admin', "updatedAt" = now() WHERE email = $1`,
  [email],
);

if (rowCount === 0) {
  console.error(`해당 이메일의 유저가 없습니다: ${email}`);
  process.exit(1);
}

console.log(`${email} 계정에 admin 역할을 부여했습니다.`);
await pool.end();
