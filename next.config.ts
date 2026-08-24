import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/Cloud Run 배포용: 실행에 필요한 파일만 .next/standalone 으로 출력
  output: "standalone",
};

export default nextConfig;
