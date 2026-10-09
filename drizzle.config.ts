import { defineConfig } from "drizzle-kit";

// 콘텐츠(도메인) 테이블 전용 설정. auth 계열 테이블(user/session/account/
// verification)은 Better Auth 마이그레이터(scripts/migrate.mjs)가 관리한다.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Better Auth가 관리하는 테이블을 push/diff 대상에서 제외 (필수 — 없으면
  // drizzle가 스키마에 없는 auth 테이블을 삭제 대상으로 취급한다)
  tablesFilter: ["contests", "news", "media", "projects"],
});
