// DEV-ONLY: seed placeholder published editorial content (notices / schedule /
// FAQ) so the public /notices page has realistic demo entries in LIVE mode.
// Idempotent by slug (all slugs are "seed-*"). Guarded: localhost DB +
// NODE_ENV!=production + GYCA_DEV_SEED=1.
import pg from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

if (process.env.GYCA_DEV_SEED !== "1") { console.error("Set GYCA_DEV_SEED=1"); process.exit(1); }
const url =
  process.env.DATABASE_URL ||
  (readFileSync(".env.local", "utf8").match(/DATABASE_URL=(.*)/)?.[1] ?? "").trim();
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || process.env.NODE_ENV === "production") {
  console.error("Refusing: local dev DB only."); process.exit(1);
}

// Items are placeholder demo content — not official schedules or results.
const ITEMS = [
  {
    slug: "seed-2027-calendar", category: "schedule", date: "2026-02-01",
    title: { en: "2027 GYCA competition calendar", ko: "2027 GYCA 공모전 전체 일정 안내" },
    summary: { en: "Key dates for entry, judging, and results across the 2027 competitions.", ko: "2027년 각 공모전의 접수·심사·결과 발표 주요 일정을 안내드립니다." },
    body: { en: "Entry opens in autumn 2026 and closes at year end, with judging over the following weeks and finalists announced ahead of the Leipzig 2027 edition. Exact dates for each division are listed on the relevant competition page.", ko: "접수는 2026년 가을에 시작해 연말에 마감되며, 이후 몇 주간 심사를 거쳐 라이프치히 2027 본선에 앞서 본선 진출작을 발표합니다. 부문별 정확한 일정은 각 공모전 페이지에서 확인하세요." },
  },
  {
    slug: "seed-review-period", category: "schedule", date: "2026-02-05",
    title: { en: "Judging & results announcement period", ko: "심사 및 결과 발표 일정 안내" },
    summary: { en: "When judging takes place and how results are shared.", ko: "심사가 진행되는 기간과 결과 공개 방식을 안내합니다." },
    body: { en: "Every entry is reviewed by field experts against the published criteria. Results are released on the competition page and by email to each applicant once judging is complete.", ko: "모든 접수작은 각 분야 전문가가 공개된 기준에 따라 심사합니다. 심사가 끝나면 공모전 페이지와 개별 이메일을 통해 결과를 안내드립니다." },
  },
  {
    slug: "seed-result-announcement", category: "notice", date: "2026-12-20",
    title: { en: "2027 finalist announcement schedule", ko: "2027 본선 진출작 발표 일정 안내" },
    summary: { en: "How and when the 2027 finalists will be announced.", ko: "2027 본선 진출작을 언제, 어떻게 발표하는지 안내드립니다." },
    body: { en: "Finalists will be published on the Winners page and notified individually by email. Please keep the contact details on your entry up to date so you don't miss the announcement.", ko: "본선 진출작은 수상작 페이지에 게시되며 개별 이메일로도 안내됩니다. 발표를 놓치지 않도록 접수 시 기재한 연락처를 최신 상태로 유지해 주세요." },
  },
  {
    slug: "seed-venue-guide", category: "notice", date: "2026-11-10",
    title: { en: "Leipzig 2027 finals — visiting guide", ko: "라이프치히 2027 본선 관람 안내" },
    summary: { en: "Information for visiting the Leipzig 2027 finals exhibition.", ko: "라이프치히 2027 본선 전시 관람을 위한 안내입니다." },
    body: { en: "The finals exhibition will be open to the public during the event period. Venue, opening hours, and access details will be shared here closer to the date.", ko: "본선 전시는 행사 기간 동안 일반 관람이 가능합니다. 장소, 운영 시간, 오시는 길 등 자세한 정보는 행사 시점에 맞춰 이 페이지에 안내드립니다." },
  },
  {
    slug: "seed-partner-recruit", category: "notice", date: "2026-10-01",
    title: { en: "Call for partners & supporting institutions", ko: "협력 기관·후원 파트너 모집 안내" },
    summary: { en: "GYCA is looking for partners to support young creators.", ko: "청소년 창작자를 지원할 협력 기관과 후원 파트너를 찾습니다." },
    body: { en: "Schools, galleries, and cultural institutions interested in partnering on exhibitions, mentorship, or overseas programs are welcome to get in touch through the contact address in the footer.", ko: "전시, 멘토링, 해외 프로그램 등에서 함께할 학교·갤러리·문화기관의 참여를 환영합니다. 하단의 문의 이메일로 연락해 주세요." },
  },
  {
    slug: "seed-eligibility", category: "faq", date: "2026-02-10",
    title: { en: "Who can enter GYCA competitions?", ko: "참가 연령과 자격은 어떻게 되나요?" },
    summary: { en: "Eligibility and age range for applicants.", ko: "참가 대상과 연령 범위를 안내합니다." },
    body: { en: "GYCA competitions are open to young creators aged 7–18. Some divisions may set a narrower range — check each competition page for its specific eligibility.", ko: "GYCA 공모전은 7~18세 청소년 창작자를 대상으로 합니다. 일부 부문은 연령 범위를 더 좁게 둘 수 있으니, 각 공모전 페이지의 참가 자격을 확인하세요." },
  },
  {
    slug: "seed-submission-format", category: "faq", date: "2026-02-11",
    title: { en: "How do I submit, and what formats are accepted?", ko: "작품 제출 규격과 방법은 어떻게 되나요?" },
    summary: { en: "Submission steps and accepted file formats.", ko: "접수 절차와 제출 가능한 파일 규격을 안내합니다." },
    body: { en: "Entries are submitted online. Accepted formats depend on the division — images, PDF, video, or audio — and the exact limits are shown in the submission form for each competition.", ko: "접수는 온라인으로 진행됩니다. 이미지·PDF·영상·음원 등 제출 규격은 부문마다 다르며, 정확한 조건은 각 공모전의 접수 폼에서 확인할 수 있습니다." },
  },
  {
    slug: "seed-overseas", category: "faq", date: "2026-02-12",
    title: { en: "How do the overseas exhibition and activities work?", ko: "해외 전시·활동은 어떻게 참여하나요?" },
    summary: { en: "About the international exhibition and activity opportunities.", ko: "해외 전시와 활동 참여 기회에 대한 안내입니다." },
    body: { en: "Depending on the competition, selected creators may be invited to take part in an overseas exhibition and related activities. Participation details are shared with selected applicants individually.", ko: "공모전에 따라, 선정된 창작자는 해외 전시와 관련 활동에 참여하도록 초청될 수 있습니다. 구체적인 참여 방법은 선정자에게 개별적으로 안내드립니다." },
  },
];

const USER = "U9ny4y47ltaAe40baL6tAvy1WCXZG7vS"; // existing editorial author (admin)
const c = new pg.Client(url);
await c.connect();
let inserted = 0, skipped = 0;
try {
  // Make sure the author still exists; otherwise fall back to any user.
  const author = (await c.query('SELECT id FROM "user" WHERE id=$1', [USER])).rows[0]?.id
    ?? (await c.query('SELECT id FROM "user" LIMIT 1')).rows[0]?.id;
  if (!author) throw new Error("No user to attribute content to.");

  for (const it of ITEMS) {
    const id = randomUUID();
    const ts = `${it.date}T09:00:00.000Z`;
    const content = JSON.stringify({
      title: it.title, summary: it.summary, body: it.body,
      displayDate: it.date, coverImage: null,
    });
    const res = await c.query(
      `INSERT INTO gyca_editorial_content(id,slug,category,status,revision,content,created_by,created_at,updated_at,published_at)
       VALUES($1,$2,$3,'published',1,$4::jsonb,$5,$6,$6,$6)
       ON CONFLICT(slug) DO NOTHING RETURNING id`,
      [id, it.slug, it.category, content, author, ts],
    );
    if (res.rows.length) {
      await c.query(
        `INSERT INTO gyca_editorial_content_changes(content_id,revision,status,snapshot,actor_id,reason,created_at)
         VALUES($1,1,'published',$2::jsonb,$3,'published',$4)
         ON CONFLICT(content_id,revision) DO NOTHING`,
        [id, content, author, ts],
      );
      inserted++;
    } else {
      skipped++;
    }
  }
  console.log(JSON.stringify({ inserted, skipped, total: ITEMS.length }));
} finally {
  await c.end();
}
