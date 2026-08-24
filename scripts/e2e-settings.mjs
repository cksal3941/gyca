// 설정 페이지 검증: 로그인 → /settings 각 탭 → 이름 변경 저장
// 사용법: node scripts/e2e-settings.mjs (dev 서버 3000 포트 필요)
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const SHOT = (n) => `C:/Users/PC/AppData/Local/Temp/e2e-set-${n}.png`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1500, height: 900 },
});
const page = await browser.newPage();

// 로그인
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("#email", "test@example.com");
await page.type("#password", "password1234");
await page.click("button[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle0" });

// 드롭다운에 Settings 항목 확인
await page.waitForSelector('button[aria-label="Account menu"]');
await page.click('button[aria-label="Account menu"]');
await page.waitForSelector('a[href="/settings"]');
await page.screenshot({ path: SHOT("0-dropdown") });
console.log("dropdown has Settings");

// 설정 페이지 이동
await page.click('a[href="/settings"]');
await page.waitForFunction(() => location.pathname === "/settings");
await page.waitForSelector("#name");
await page.screenshot({ path: SHOT("1-profile") });
console.log("profile tab shown");

// 이름 변경 저장
await page.click("#name", { clickCount: 3 });
await page.type("#name", "Test User");
const buttons = await page.$$("button");
for (const b of buttons) {
  const t = await b.evaluate((el) => el.textContent);
  if (t?.includes("Save profile")) {
    await b.click();
    break;
  }
}
await page.waitForSelector("text/Profile updated", { timeout: 8000 });
console.log("profile saved");

// 나머지 탭
for (const [label, sel] of [
  ["Security", "text/Change password"],
  ["Sessions", "text/Active sessions"],
  ["Account", "text/Danger zone"],
]) {
  const tabs = await page.$$("nav button");
  for (const t of tabs) {
    const txt = await t.evaluate((el) => el.textContent);
    if (txt?.trim() === label) {
      await t.click();
      break;
    }
  }
  await page.waitForSelector(sel, { timeout: 8000 });
  await page.screenshot({ path: SHOT(label.toLowerCase()) });
  console.log(`${label} tab shown`);
}

await browser.close();
console.log("SETTINGS E2E OK");
