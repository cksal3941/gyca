// 소셜 로그인 공급자는 환경변수가 모두 설정된 경우에만 활성화된다.
// src/lib/auth.ts(서버 설정)와 /api/v1/auth/providers(클라이언트 노출)가 같은 판정을 쓴다.

export type SocialProviderId = "google";

export function enabledSocialProviders(
  env: NodeJS.ProcessEnv = process.env,
): SocialProviderId[] {
  const providers: SocialProviderId[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) providers.push("google");
  return providers;
}
