// Sign in with Apple 용 client secret(JWT, ES256) 생성기.
// Apple 은 client secret 을 최대 6개월(15777000초) 유효한 JWT 로 요구한다. 만료 전에
// 다시 생성해 Cloud Run 의 APPLE_CLIENT_SECRET 을 갱신해야 한다.
//
// 사용법:
//   node scripts/apple-client-secret.mjs --team <TEAM_ID> --key-id <KEY_ID> \
//     --client-id <SERVICES_ID> --key <AuthKey_XXXX.p8 경로> [--days 180]
//
// 출력은 JWT 한 줄이다. 저장소나 채팅에 남기지 말고 배포 시크릿에만 넣는다.
import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const teamId = opt("team");
const keyId = opt("key-id");
const clientId = opt("client-id");
const keyPath = opt("key");
const days = Number(opt("days", "180"));

if (!teamId || !keyId || !clientId || !keyPath || !Number.isFinite(days) || days <= 0 || days > 182) {
  console.error(
    "usage: node scripts/apple-client-secret.mjs --team TEAM_ID --key-id KEY_ID --client-id SERVICES_ID --key AuthKey.p8 [--days 1..182]",
  );
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
const payload = b64url(
  JSON.stringify({
    iss: teamId,
    iat: now,
    exp: now + days * 24 * 60 * 60,
    aud: "https://appleid.apple.com",
    sub: clientId,
  }),
);
const signingInput = `${header}.${payload}`;
const privateKey = createPrivateKey(readFileSync(keyPath, "utf8"));
const signature = sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });

process.stdout.write(`${signingInput}.${b64url(signature)}\n`);
console.error(`expires: ${new Date((now + days * 86400) * 1000).toISOString()}`);
