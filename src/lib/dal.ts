import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** 요청당 한 번만 DB 세션 조회 (React.cache로 중복 호출 dedupe). */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * admin 전용 가드. 레이아웃만이 아니라 모든 admin 페이지·서버 액션·라우트
 * 핸들러 안에서 호출해야 한다 — 레이아웃의 체크는 하위 세그먼트 렌더링을
 * 막지 못하고, 서버 액션은 UI를 거치지 않은 직접 POST로도 호출될 수 있다.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");
  return session;
}
