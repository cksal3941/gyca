import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { configuredReceiptMailer } from "../server/notifications/resend";
import { createVerificationEmail } from "../server/notifications/verification-email";
import { createPasswordResetEmail } from "../server/notifications/password-reset-email";

const verifyEmail = process.env.AUTH_EMAIL_VERIFICATION_ENABLED === "true";
const resetPassword = process.env.AUTH_PASSWORD_RESET_ENABLED === "true";

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
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: verifyEmail,
    resetPasswordTokenExpiresIn: 1800,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: resetPassword ? createPasswordResetEmail(configuredReceiptMailer(process.env), process.env.BETTER_AUTH_URL) : undefined,
  },
  emailVerification: verifyEmail ? {
    sendOnSignUp: true, sendOnSignIn: false, expiresIn: 3600, autoSignInAfterVerification: false,
    sendVerificationEmail: createVerificationEmail(configuredReceiptMailer(process.env), process.env.BETTER_AUTH_URL),
  } : undefined,
  rateLimit: { enabled: verifyEmail || resetPassword || process.env.NODE_ENV === "production", storage: verifyEmail || resetPassword ? "database" : "memory", window: 60, max: 100,
    customRules: { "/send-verification-email": { window: 60, max: 3 }, "/sign-up/email": { window: 60, max: 3 },
      "/request-password-reset": { window: 60, max: 3 }, "/reset-password": { window: 60, max: 5 } } },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders,
  // Apple 로그인의 form_post 콜백을 허용하기 위해 필요
  trustedOrigins: ["https://appleid.apple.com"],
  plugins: [nextCookies()],
});
