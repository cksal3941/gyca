import { createHash } from "node:crypto";
import { z } from "zod";
import { EntryFault } from "../entries/errors.ts";
import type { ReceiptMailer } from "./resend.ts";

export function createVerificationEmail(mailer: ReceiptMailer | null, origin: string | undefined) {
  return async (data: { readonly user: { readonly email: string }; readonly url: string; readonly token: string }) => {
    if (mailer === null || origin === undefined) throw new EntryFault("POLICY_NOT_CONFIGURED", 503);
    const configured = new URL(origin);
    const url = new URL(data.url);
    if (configured.protocol !== "https:" || configured.username || configured.password
      || url.origin !== configured.origin || url.pathname !== "/api/auth/verify-email"
      || url.searchParams.get("token") !== data.token || !data.token)
      throw new EntryFault("FORBIDDEN", 403);
    url.searchParams.set("callbackURL", "/login");
    const email = z.email().parse(data.user.email);
    await mailer.send({ from: mailer.from, to: [email], subject: "GYCA — Verify your email / 이메일 확인",
      text: `Verify your email address using this link within 1 hour.\n1시간 안에 아래 링크를 눌러 이메일을 확인해주세요.\n${url.toString()}\nIf you did not request this, ignore this email. / 요청하지 않았다면 이 메일을 무시해주세요.` },
      `gyca-verify-${createHash("sha256").update(JSON.stringify([email, data.token])).digest("hex")}`);
  };
}
