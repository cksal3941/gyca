import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/Cloud Run 배포용: 실행에 필요한 파일만 .next/standalone 으로 출력.
  // Vercel에서는 플랫폼 기본 출력을 쓰도록 standalone을 끈다.
  output: process.env.VERCEL ? undefined : "standalone",
  // 파일 추적이 @swc/helpers의 esm/ 폴더를 누락해 standalone 서버가
  // MODULE_NOT_FOUND로 죽는 문제를 보정 (pnpm .pnpm 스토어 경로 기준)
  outputFileTracingIncludes: {
    "/*": ["./node_modules/.pnpm/@swc+helpers*/node_modules/@swc/helpers/**/*"],
  },
};

export default nextConfig;
