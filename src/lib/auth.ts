import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { pool } from "@/lib/db";

// 소셜 로그인은 환경변수가 설정된 경우에만 활성화 (없어도 앱은 동작)
const socialProviders: Record<
  string,
  { clientId: string; clientSecret: string }
> = {};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  socialProviders.apple = {
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  database: pool,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders,
  // Apple 로그인의 form_post 콜백을 허용하기 위해 필요
  trustedOrigins: ["https://appleid.apple.com"],
  // admin(): user 테이블에 role/banned 컬럼과 유저 관리 API를 추가
  plugins: [admin(), nextCookies()],
});
