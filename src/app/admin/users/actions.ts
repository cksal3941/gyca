"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/dal";

async function guard(userId: string) {
  const session = await requireAdmin();
  // 자기 자신의 권한 변경/차단은 막는다 (마지막 관리자 잠금 사고 방지)
  if (!userId || userId === session.user.id) return false;
  return true;
}

export async function setUserRole(userId: string, role: "admin" | "user") {
  if (!(await guard(userId))) return;
  await auth.api.setRole({
    body: { userId, role: role === "admin" ? "admin" : "user" },
    headers: await headers(),
  });
}

export async function banUser(userId: string) {
  if (!(await guard(userId))) return;
  await auth.api.banUser({
    body: { userId },
    headers: await headers(),
  });
}

export async function unbanUser(userId: string) {
  if (!(await guard(userId))) return;
  await auth.api.unbanUser({
    body: { userId },
    headers: await headers(),
  });
}

export async function revokeUserSessions(userId: string) {
  if (!(await guard(userId))) return;
  await auth.api.revokeUserSessions({
    body: { userId },
    headers: await headers(),
  });
}
