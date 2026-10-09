import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { enabledSocialProviders } from "@/lib/social-providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 로그인/회원가입 화면이 설정된 소셜 공급자 버튼만 보여 주도록 공개 목록을 돌려준다.
export function GET() {
  return NextResponse.json(
    {
      data: { providers: enabledSocialProviders() },
      meta: { requestId: randomUUID(), serverTime: new Date().toISOString() },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
