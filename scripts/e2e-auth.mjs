// 로그인 → 아바타 드롭다운 → Sign out 페이지 → 로그아웃 플로우 검증
// 사용법: node scripts/e2e-auth.mjs (dev 서버가 3000 포트에 떠 있어야 함)
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const SHOT = (n) => `C:/Users/PC/AppData/Local/Temp/e2e-${n}.png`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1700, height: 800 },
});
const page = await browser.newPage();

// 1. 로그인
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("#email", "test@example.com");
await page.type("#password", "password1234");
await page.click("button[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle0" });
console.log("1. signed in, now at:", page.url());

// 2. 헤더의 아바타 확인
await page.waitForSelector('button[aria-label="Account menu"]', {
  timeout: 10000,
});
await page.screenshot({ path: SHOT("1-header-logged-in") });

// 3. 아바타 클릭 → 드롭다운
await page.click('button[aria-label="Account menu"]');
await page.waitForSelector("text/Signed in as", { timeout: 5000 });
await page.screenshot({ path: SHOT("2-dropdown-open") });
console.log("2. dropdown open");

// 4. Sign out 클릭 → /signout 페이지
await page.click('a[href="/signout"]');
await page.waitForFunction(() => location.pathname === "/signout");
await page.waitForSelector("text/Are you sure", { timeout: 5000 });
await page.screenshot({ path: SHOT("3-signout-page") });
console.log("3. signout page shown");

// 5. Sign out 버튼 클릭 → 홈으로, 로그아웃 확인
const btns = await page.$$("button");
for (const b of btns) {
  const t = await b.evaluate((el) => el.textContent);
  if (t?.trim() === "Sign out") {
    await b.click();
    break;
  }
}
await page.waitForFunction(() => location.pathname === "/", { timeout: 10000 });
await page.waitForSelector('a[href="/login"]', { timeout: 10000 });
await page.screenshot({ path: SHOT("4-after-signout") });
console.log("4. signed out, header shows Sign in again");

await browser.close();
console.log("E2E OK");
