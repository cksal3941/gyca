// 소셜 로그인 공급자는 환경변수가 모두 설정된 경우에만 활성화된다.
// src/lib/auth.ts(서버 설정)와 /api/v1/auth/providers(클라이언트 노출)가 같은 판정을 쓴다.
// 배열 순서가 로그인 화면의 버튼 순서다.

export type SocialProviderId = "google" | "microsoft" | "facebook" | "kakao";

export const SOCIAL_PROVIDER_ORDER: SocialProviderId[] = [
  "google",
  "microsoft",
  "facebook",
  "kakao",
];

const ENV_PREFIX: Record<SocialProviderId, string> = {
  google: "GOOGLE",
  microsoft: "MICROSOFT",
  facebook: "FACEBOOK",
  kakao: "KAKAO",
};

export function socialProviderCredentials(
  id: SocialProviderId,
  env: NodeJS.ProcessEnv = process.env,
): { clientId: string; clientSecret: string } | null {
  const clientId = env[`${ENV_PREFIX[id]}_CLIENT_ID`];
  const clientSecret = env[`${ENV_PREFIX[id]}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function enabledSocialProviders(
  env: NodeJS.ProcessEnv = process.env,
): SocialProviderId[] {
  return SOCIAL_PROVIDER_ORDER.filter((id) => socialProviderCredentials(id, env) !== null);
}
