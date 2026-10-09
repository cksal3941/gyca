import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { configuredReceiptMailer } from "../server/notifications/resend";
import { createVerificationEmail } from "../server/notifications/verification-email";
import { createPasswordResetEmail } from "../server/notifications/password-reset-email";
import { socialProviderCredentials } from "./social-providers";

const verifyEmail = process.env.AUTH_EMAIL_VERIFICATION_ENABLED === "true";
const resetPassword = process.env.AUTH_PASSWORD_RESET_ENABLED === "true";

// 소셜 로그인은 환경변수가 설정된 경우에만 활성화 (없어도 앱은 동작).
// 활성 여부 판정은 src/lib/social-providers.ts 와 공유한다.
const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

const google = socialProviderCredentials("google");
if (google) socialProviders.google = google;

const microsoft = socialProviderCredentials("microsoft");
// tenantId "common": 개인(Outlook/Hotmail) 계정과 학교·직장(Microsoft 365) 계정 모두 허용
if (microsoft) socialProviders.microsoft = { ...microsoft, tenantId: "common" };

const facebook = socialProviderCredentials("facebook");
if (facebook) socialProviders.facebook = facebook;

const kakao = socialProviderCredentials("kakao");
if (kakao) socialProviders.kakao = kakao;

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
  account: {
    accountLinking: {
      enabled: true,
      // 공급자가 검증한 이메일이 기존 이메일·비밀번호 계정과 같으면 그 계정에
      // 자동으로 연결한다 (별도 계정이 생기지 않음). Google/Microsoft/Facebook 은
      // 검증된 이메일만 넘겨주므로 신뢰한다. Kakao 는 is_email_verified 값을 그대로 따른다.
      trustedProviders: ["google", "microsoft", "facebook"],
      // 이메일 인증 기능이 꺼져 있어 로컬 계정의 emailVerified 가 false 로 남는다.
      // 공급자가 이메일 소유를 검증했으므로 로컬 미확인 상태여도 연결을 허용한다.
      requireLocalEmailVerified: false,
    },
  },
  plugins: [nextCookies()],
});
