// 관리자 페이지 검증: 로그인 → /admin 대시보드 → Users → News CRUD → 홈 반영 확인
// 사용법: node scripts/e2e-admin.mjs (dev 서버 3000 포트, admin 계정 필요)
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = "http://localhost:3000";
const SHOT = (n) => `C:/Users/PC/AppData/Local/Temp/e2e-admin-${n}.png`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1500, height: 900 },
});
const page = await browser.newPage();

// 비로그인 상태에서 /admin 접근 → /login 리다이렉트 (proxy 체크)
await page.goto(`${BASE}/admin`, { waitUntil: "networkidle0" });
if (!page.url().includes("/login")) {
  throw new Error(`unauthenticated /admin not redirected: ${page.url()}`);
}
console.log("unauthenticated /admin redirects to /login");

// 로그인
await page.type("#email", "test@example.com");
await page.type("#password", "password1234");
await page.click("button[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle0" });

// 드롭다운에 Admin 항목 확인
await page.waitForSelector('button[aria-label="Account menu"]');
await page.click('button[aria-label="Account menu"]');
await page.waitForSelector('a[href="/admin"]');
await page.screenshot({ path: SHOT("0-dropdown") });
console.log("dropdown has Admin");

// 대시보드
await page.click('a[href="/admin"]');
await page.waitForFunction(() => location.pathname === "/admin");
await page.waitForSelector("text/Dashboard");
await page.screenshot({ path: SHOT("1-dashboard") });
console.log("dashboard shown");

// Users
await page.goto(`${BASE}/admin/users`, { waitUntil: "networkidle0" });
await page.waitForSelector("text/test@example.com");
await page.screenshot({ path: SHOT("2-users") });
console.log("users table shows test user");

// News 목록
await page.goto(`${BASE}/admin/news`, { waitUntil: "networkidle0" });
await page.waitForSelector("text/New article");
await page.screenshot({ path: SHOT("3-news-list") });

// News 생성
await page.goto(`${BASE}/admin/news/new`, { waitUntil: "networkidle0" });
await page.type("#title", "E2E 테스트 공지");
await page.type("#date", "2026-08-25");
await page.type("#tag", "공지 사항");
await page.select("#tagColor", "text-neutral-500");
await page.click("button[type=submit]");
await page.waitForFunction(() => location.pathname === "/admin/news");
await page.waitForSelector("text/E2E 테스트 공지");
await page.screenshot({ path: SHOT("4-news-created") });
console.log("news created");

// 홈 반영 확인
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.waitForSelector("text/E2E 테스트 공지");
await page.screenshot({ path: SHOT("5-home"), fullPage: false });
console.log("news visible on homepage");

// News 삭제 (생성한 항목)
await page.goto(`${BASE}/admin/news`, { waitUntil: "networkidle0" });
const rows = await page.$$("tbody tr");
let deleted = false;
for (const row of rows) {
  const text = await row.evaluate((el) => el.textContent);
  if (text?.includes("E2E 테스트 공지")) {
    const buttons = await row.$$("button");
    for (const b of buttons) {
      const t = await b.evaluate((el) => el.textContent);
      if (t?.trim() === "Delete") {
        await b.click();
        break;
      }
    }
    // 두 단계 확인
    await page.waitForFunction(
      (el) => el.textContent.includes("Confirm"),
      {},
      row,
    );
    const confirms = await row.$$("button");
    for (const b of confirms) {
      const t = await b.evaluate((el) => el.textContent);
      if (t?.trim() === "Confirm") {
        await b.click();
        deleted = true;
        break;
      }
    }
    break;
  }
}
if (!deleted) throw new Error("delete button not found");
// 주의: body.textContent는 초기 RSC 페이로드 <script> 태그에 남은 텍스트까지
// 포함하므로 테이블 행만 검사한다
await page.waitForFunction(
  () =>
    !Array.from(document.querySelectorAll("tbody tr")).some((r) =>
      r.textContent.includes("E2E 테스트 공지"),
    ),
  { timeout: 20000 },
);
await page.screenshot({ path: SHOT("6-news-deleted") });
console.log("news deleted");

// Contests 목록
await page.goto(`${BASE}/admin/contests`, { waitUntil: "networkidle0" });
await page.waitForSelector("text/New contest");
await page.screenshot({ path: SHOT("7-contests") });
console.log("contests list shown");

await browser.close();
console.log("PASS: admin e2e complete");
