import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// 낙관적 1차 체크: 세션 쿠키가 아예 없으면 /admin 접근을 즉시 로그인으로
// 돌려보낸다. 쿠키 존재만 보는 얕은 검사이므로 실제 권한 검증은 각 페이지와
// 서버 액션의 requireAdmin()(src/lib/dal.ts)이 담당한다.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
