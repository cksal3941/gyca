import { createHash } from "node:crypto";
import { z } from "zod";
import { EntryFault } from "../entries/errors.ts";
import type { ReceiptMailer } from "./resend.ts";

export function createPasswordResetEmail(mailer: ReceiptMailer | null, origin: string | undefined) {
  return async (data: { readonly user: { readonly email: string }; readonly token: string }) => {
    const configured = z.url().safeParse(origin);
    if (mailer === null || !configured.success) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
    const url = new URL(configured.data);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
    const token = z.string().regex(/^[A-Za-z0-9_-]{20,128}$/).parse(data.token);
    const email = z.email().parse(data.user.email);
    url.pathname = "/reset-password";
    url.hash = token;
    await mailer.send({ from: mailer.from, to: [email], subject: "GYCA — Reset your password / 비밀번호 재설정",
      text: `Use this link within 30 minutes to choose a new password.\n30분 안에 아래 링크에서 새 비밀번호를 설정해주세요.\n${url.toString()}\nExisting sessions will be signed out after the change.\n변경 후 기존 로그인 세션이 종료됩니다.\nIf you did not request this, ignore this email. / 요청하지 않았다면 무시해주세요.` },
      `gyca-reset-${createHash("sha256").update(JSON.stringify([email, token])).digest("hex")}`);
  };
}
