import { Fragment } from "react";
import type { Metadata } from "next";
import PosterSlider from "@/components/site/PosterSlider";
import { getServerLocale } from "@/lib/i18n/server";
import { CONTESTS, effectiveContestStatus } from "@/lib/site-data";
import { SITE_URL } from "@/lib/seo";
import type { Locale } from "@/lib/i18n";

// Dedicated Leipzig 2027 detail (static segment, takes precedence over /contests/[slug]).
// All copy below mirrors the official call-for-entries poster
// (/images/leipzig-2027-poster.jpg); anything the poster defers ("announced
// separately") is stated as such rather than invented.

type I18n = { en: string; ko: string };

const CANONICAL_PATH = "/contests/leipzig-2027";
const POSTER = "/images/leipzig-2027-poster.jpg";

const META = {
  title: {
    en: "International Youth Art Book Award 2027 in Leipzig",
    ko: "2027 라이프치히 국제 청소년 아트북 어워드",
  },
  summary: {
    en: "An international competition celebrating books created by children and young people, with finalists featured at the Leipzig Book Fair 2027.",
    ko: "어린이·청소년이 직접 만든 책을 기념하는 국제 공모전. 본선작은 2027 라이프치히 도서전에서 소개됩니다.",
  },
  intro: {
    en: "We invite book-based creative works by young creators aged 7–18 worldwide. Every participant receives an individual review report; finalists receive an official English selection certificate and seal, and their works are introduced in the Leipzig Book Fair programme (18–21 Mar 2027).",
    ko: "전 세계 만 7–18세 청소년 창작자의 책 기반 창작물을 모집합니다. 모든 참가자에게 개별 심사 보고서가 제공되며, 본선 진출작에는 영문 공식 선정 인증서와 인증 도장이 발급되고 라이프치히 도서전(2027.03.18–21) 프로그램에서 소개됩니다.",
  },
} satisfies Record<string, I18n>;

const KEY_FACTS: { label: I18n; value: I18n }[] = [
  { label: { en: "Eligibility", ko: "참가 자격" }, value: { en: "Young creators aged 7–18 worldwide", ko: "전 세계 만 7–18세" } },
  { label: { en: "Categories", ko: "부문" }, value: { en: "Picture Books · Photo Books · Essays · Poetry", ko: "그림책 · 사진집 · 에세이 · 시" } },
  { label: { en: "Pre-submission", ko: "사전 제출" }, value: { en: "English manuscript · 1 PDF · 20+ inner pages excl. cover · max 100 MB", ko: "영문 원고 · PDF 1개 · 표지 제외 내지 20쪽 이상 · 최대 100MB" } },
  { label: { en: "Entry fee", ko: "사전 심사비" }, value: { en: "$120 per entry", ko: "작품당 기관 ₩120,000 / 개인 ₩150,000" } },
  { label: { en: "Entry deadline", ko: "접수 마감" }, value: { en: "15 Jan 2027", ko: "2027.01.15" } },
  { label: { en: "Final exhibition", ko: "본선 전시" }, value: { en: "Leipzig Book Fair · 18–21 Mar 2027", ko: "라이프치히 도서전 · 2027.03.18–21" } },
];

const AGE_GROUPS: I18n = {
  en: "Primary: 7–12 · Junior: 13–15 · Senior: 16–18",
  ko: "Primary 7–12세 · Junior 13–15세 · Senior 16–18세",
};

const PRE_SUBMISSION: I18n = {
  en: "Pre-submission for every category: one English manuscript PDF with at least 20 inner pages (excluding the cover), max 100 MB.",
  ko: "모든 부문 공통 사전 제출물: 표지 제외 내지 20쪽 이상의 영문 원고 PDF 파일 1개 (최대 100MB).",
};

const CATEGORIES: { name: I18n; req: I18n }[] = [
  { name: { en: "Picture Books", ko: "그림책" }, req: { en: "Stories told through pictures and text", ko: "그림과 글로 전하는 이야기" } },
  { name: { en: "Photo Books", ko: "사진집" }, req: { en: "Original stories told through photography", ko: "사진으로 전하는 오리지널 이야기" } },
  { name: { en: "Essays", ko: "에세이" }, req: { en: "Prose works · Illustrations and photographs are permitted", ko: "산문 작품 · 일러스트·사진 포함 가능" } },
  { name: { en: "Poetry", ko: "시" }, req: { en: "Poems and poetry collections · Illustrations and photographs are permitted", ko: "시·시집 · 일러스트·사진 포함 가능" } },
];

const CATEGORY_NOTES: I18n[] = [
  { en: "Works must be created by the participant and must not infringe anyone else’s copyright.", ko: "작품은 참가자 본인이 창작한 것이어야 하며, 타인의 저작권을 침해해서는 안 됩니다." },
  { en: "Published works and entries to other competitions are eligible.", ko: "출판된 작품 및 타 공모전 출품작도 참가할 수 있습니다." },
  { en: "AI-generated works are not eligible.", ko: "AI 생성 작품은 참가할 수 없습니다." },
];

const REGISTRATION = {
  // Locale-specific: Korean shows the domestic (KRW bank transfer) fees,
  // English shows the international (USD online payment) fee.
  fees: {
    en: [{ type: "Online payment · per entry", fee: "$120" }],
    ko: [
      { type: "계좌이체 · 기관 출품", fee: "₩120,000" },
      { type: "계좌이체 · 개인 출품", fee: "₩150,000" },
    ],
  } satisfies Record<Locale, { type: string; fee: string }[]>,
  feeNote: {
    en: "Preliminary judging fee per entry, paid online. Overseas payment charges are included.",
    ko: "작품당 사전 심사비이며, 국내 계좌이체로 납부합니다.",
  } as I18n,
  workType: { en: "Entry type: Individual or Institution / group", ko: "출품 유형: 개인 참가 또는 기관·단체 참가" } as I18n,
  rules: [
    { en: "Submit a separate application for each work (multiple entries allowed).", ko: "작품마다 별도로 신청서를 제출합니다(복수 출품 가능)." },
    { en: "Collaborative works: list every participating creator and their role in the work information.", ko: "공동 작품은 작품 정보란에 참여 작가 전원과 각자의 역할을 기재합니다." },
    { en: "The fee applies per entry, regardless of the number of creators.", ko: "출품료는 참여 작가 수와 관계없이 작품당 부과됩니다." },
    { en: "A Google account is required to upload the PDF in the application form.", ko: "신청서에서 작품 PDF를 업로드하려면 Google 계정이 필요합니다." },
  ] as I18n[],
};

// What the official application form (Google Form) asks for — so applicants can prepare.
const HOW_TO_APPLY = {
  intro: {
    en: "Submit one application form per work. For a collaborative work, enter the lead participant’s details and list every co-creator and their role in the “co-creators” field.",
    ko: "작품 하나당 신청서 하나를 제출합니다. 공동 작품은 대표 참여자의 정보를 입력하고, ‘공동 참여 작가’ 항목에 모든 공동 참여 작가와 각자의 역할을 기재합니다.",
  } as I18n,
  groups: [
    {
      title: { en: "Participant", ko: "참가자 정보" },
      items: [
        { en: "Name in native language and in English (exactly as it should appear on the English certificate)", ko: "모국어 성명 및 영문 성명 (영문 증서에 표기될 이름과 정확히 동일하게)" },
        { en: "Date of birth (including year) and country of residence", ko: "생년월일(출생 연도 포함) 및 거주 국가" },
        { en: "School, grade or affiliation (e.g. ABC Middle School, Grade 8 / Homeschool)", ko: "학교·학년 또는 소속 (예: ABC 중학교 8학년 / 홈스쿨링)" },
        { en: "Age division as of the application date", ko: "신청일 기준 연령 구분" },
      ],
    },
    {
      title: { en: "Contact", ko: "담당자·연락처" },
      items: [
        { en: "Form completed by: participant / parent or legal guardian / institution representative", ko: "작성자: 참가자 / 부모 또는 법정 보호자 / 기관 대표" },
        { en: "Contact name, phone number (with country code for international numbers) and email", ko: "담당자 이름, 연락처 전화번호(해외는 국가 코드 포함), 이메일" },
        { en: "The review report and updates are sent to this email (institutions: the representative’s email)", ko: "심사 보고서와 안내는 이 이메일로 발송됩니다 (기관 참가는 대표자 이메일)" },
        { en: "Parent or legal guardian’s name — required for participants under 18", ko: "부모 또는 법정 보호자 성함 — 18세 미만 참가자 필수" },
      ],
    },
    {
      title: { en: "Work", ko: "작품 정보" },
      items: [
        { en: "Title exactly as on the book, plus an English title if available", ko: "책에 표기된 그대로의 제목 (가능하면 영문 제목도)" },
        { en: "Publication status (published or unpublished — does not affect judging)", ko: "출판 여부 (출판·미출판 — 심사에 영향 없음)" },
        { en: "Work type: individual or collaborative (list all co-creators and roles)", ko: "작품 유형: 개인 작품 또는 공동 창작 (공동 참여 작가와 역할 기재)" },
        { en: "Language(s) used in the book (e.g. Korean / English / wordless book)", ko: "책에 사용된 언어 (예: 한국어 / 영어 / 글 없는 책)" },
        { en: "Number of inner pages (20+ excluding the cover) and closed-book size W × H × D in cm", ko: "내지 페이지 수(표지 제외 20쪽 이상) 및 닫힌 책 크기 가로 × 세로 × 두께(cm)" },
        { en: "Materials and binding (e.g. hand-bound with paper, cloth or thread; accordion fold)", ko: "재료 및 제본 방법 (예: 종이·천·실로 수제본, 아코디언 접기)" },
        { en: "Introduction of about 300 words: the story or theme and why the participant made the book, in their own ideas", ko: "약 300단어 작품 소개: 줄거리 또는 주제와 책을 만든 이유 (참가자 본인의 생각 중심)" },
        { en: "One category: Picture Books / Photo Books / Essays / Poetry", ko: "참가 부문 1개 선택: 그림책 / 사진집 / 에세이 / 시" },
      ],
    },
    {
      title: { en: "File", ko: "파일 업로드" },
      items: [
        { en: "One PDF of the work, 20+ inner pages, max 100 MB", ko: "작품 PDF 1개, 내지 20쪽 이상, 최대 100MB" },
        { en: "Uploading requires a Google account", ko: "업로드하려면 Google 계정이 필요합니다" },
      ],
    },
  ] as { title: I18n; items: I18n[] }[],
};

const BENEFITS: I18n[] = [
  { en: "Individual review report for every participant", ko: "모든 참가자에게 개별 심사 보고서 제공" },
  { en: "Finalists: official English selection certificate and seal", ko: "본선 진출작: 영문 공식 선정 인증서 및 인증 도장 발급" },
  { en: "Finalist works introduced in the Leipzig Book Fair programme", ko: "본선 진출작은 라이프치히 도서전 프로그램에서 소개" },
  { en: "International award certificate — English certificate corresponding to the award received", ko: "국제 수상 증서 — 수상 내역에 따른 영문 증서" },
  { en: "Leipzig Book Fair participation certificate — English certificate documenting the exhibition in Germany", ko: "라이프치히 도서전 참가 증서 — 독일 전시 참가를 증명하는 영문 증서" },
  { en: "Introduction to European publishers — opportunities to present work to publishing professionals and explore publication or rights discussions", ko: "유럽 출판사 소개 — 출판 관계자에게 작품을 선보이고 출판·판권 논의 기회 모색" },
  { en: "International activities for young creators: local book talks, author introductions, and exhibition photos", ko: "청소년 창작자 국제 활동 — 현지 북토크, 작가 소개, 전시 사진" },
];

const FEE_SUPPORT: { award: I18n; recipients: I18n; support: string }[] = [
  { award: { en: "Leipzig Grand Prize", ko: "라이프치히 대상" }, recipients: { en: "1 recipient", ko: "1명" }, support: "100%" },
  { award: { en: "Book as Art Excellence Award", ko: "Book as Art 최우수상" }, recipients: { en: "2 recipients", ko: "2명" }, support: "70%" },
  { award: { en: "Young Creator Distinction Award", ko: "Young Creator 우수상" }, recipients: { en: "3 recipients", ko: "3명" }, support: "50%" },
];

const KEY_DATES: { label: I18n; value: I18n }[] = [
  { label: { en: "Entry deadline", ko: "작품 제출 마감" }, value: { en: "15 Jan 2027", ko: "2027.01.15" } },
  { label: { en: "Finalists announced", ko: "본선 진출작 발표" }, value: { en: "25 Jan 2027", ko: "2027.01.25" } },
  { label: { en: "Final registration deadline", ko: "본선 등록 마감" }, value: { en: "10 Feb 2027", ko: "2027.02.10" } },
  { label: { en: "Leipzig Book Fair exhibition", ko: "라이프치히 도서전 전시" }, value: { en: "18–21 Mar 2027", ko: "2027.03.18–21" } },
];

const CONTACT_EMAIL = "gycaaward@gmail.com";

const NOTES: I18n[] = [
  { en: "Local book fair programmes are subject to final confirmation based on local operating conditions.", ko: "현지 도서전 프로그램은 현지 운영 상황에 따라 최종 확정됩니다." },
  { en: "Finalists must complete registration by the deadline to participate in the final exhibition and related events.", ko: "본선 진출자는 마감일까지 등록을 완료해야 본선 전시 및 관련 행사에 참여할 수 있습니다." },
];

export async function generateMetadata(): Promise<Metadata> {
  const locale: Locale = await getServerLocale();
  const title = META.title[locale];
  const description = META.summary[locale];
  return {
    title,
    description,
    keywords: [
      "International Youth Art Book Award 2027",
      "Leipzig Book Fair 2027",
      "라이프치히 국제 청소년 아트북 어워드",
      "청소년 아트북 공모전",
      "art book competition",
      "GYCA",
    ],
    alternates: { canonical: CANONICAL_PATH },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}${CANONICAL_PATH}`,
      images: [{ url: POSTER, width: 1600, height: 2263, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [POSTER] },
  };
}

function SectionH2({ ko, children }: { ko: boolean; children: React.ReactNode }) {
  return (
    <h2 className={`break-keep font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
      {children}
    </h2>
  );
}

// Evaluated per request on the server; kept outside the component so render stays free of clock reads.
const leipzigContest = () => CONTESTS.find((c) => c.slug === "leipzig-2027");

export default async function LeipzigDetailPage() {
  const locale: Locale = await getServerLocale();
  const ko = locale === "ko";
  const t = (v: I18n) => v[locale];

  // Entries go to the official Google Form while open; before opening / after the
  // deadline (schedule-derived) the CTA is a disabled state instead.
  const contest = leipzigContest();
  const status = contest ? effectiveContestStatus(contest) : "open";
  const formUrl = contest?.applyUrl;
  const applyCta = (variant: "desktop" | "mobile") =>
    status !== "open" || !formUrl ? (
      <div
        className={`${variant === "desktop" ? "mt-5 " : ""}inline-flex h-12 w-full cursor-default items-center justify-center rounded-[7px] bg-neutral-300 px-6 text-[16px] font-bold text-ink-strong`}
      >
        {status === "upcoming" ? (ko ? "접수 예정" : "Entries open soon") : ko ? "접수 마감" : "Entries closed"}
      </div>
    ) : (
      <a
        href={formUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${variant === "desktop" ? "mt-5 " : ""}inline-flex h-12 w-full items-center justify-center gap-2 rounded-[7px] bg-black px-6 text-[15px] font-semibold text-white hover:opacity-90`}
      >
        {ko ? "접수하기" : "Apply now"}
        <span aria-hidden>↗</span>
      </a>
    );

  return (
    <>
      {/* No header band on contest detail pages — ~100px gap from the site nav. */}
      <section className="mx-auto max-w-page px-6 pt-[100px] pb-12 lg:pb-16">
        <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:gap-16">
          <div className="min-w-0">
            <PosterSlider
              locale={locale}
              images={[POSTER]}
              labels={[ko ? "2027 라이프치히 국제 청소년 아트북 어워드 포스터" : "International Youth Art Book Award 2027 in Leipzig poster"]}
            />

            <div className="mt-10">
              <h1
                className={`break-keep text-[38px] leading-tight text-ink-strong ${
                  ko ? "font-sans font-bold tracking-[-0.01em]" : "font-title font-bold tracking-[0.02em]"
                }`}
              >
                {t(META.title)}
              </h1>
              <p className="mt-3 text-[16px] font-semibold leading-[1.7] text-ink-strong">{t(META.summary)}</p>
              <p className="mt-3 max-w-[42rem] text-[16px] leading-[1.8] text-ink-strong">{t(META.intro)}</p>
            </div>

            <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
              {KEY_FACTS.map((f) => (
                <Fragment key={f.label.en}>
                  <dt className="text-[16px] text-ink-strong">{t(f.label)}</dt>
                  <dd className="text-[16px] font-bold text-ink-strong">{t(f.value)}</dd>
                </Fragment>
              ))}
            </dl>

            {/* 01 Eligibility */}
            <div id="eligibility" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "참가 자격" : "Eligibility"}</SectionH2>
              <p className="mt-4 text-[18px] font-bold text-ink-strong">
                {ko ? "전 세계 만 7–18세 청소년 창작자" : "Young creators aged 7–18 worldwide"}
              </p>
              <p className="mt-2 text-[16px] text-ink-strong">{t(AGE_GROUPS)}</p>
            </div>

            {/* 02 Categories & requirements */}
            <div id="categories" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "부문 및 출품 규격" : "Categories & requirements"}</SectionH2>
              <p className="mt-4 border-l-4 border-brand-blue bg-canvas px-5 py-4 text-[16px] font-semibold leading-[1.7] text-ink-strong">
                {t(PRE_SUBMISSION)}
              </p>
              <dl className="mt-6 border-t border-line">
                {CATEGORIES.map((c) => (
                  <div key={c.name.en} className="grid gap-2 border-b border-line py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
                    <dt className="text-[16px] font-bold text-brand-blue">{t(c.name)}</dt>
                    <dd className="text-[16px] leading-[1.7] text-ink-strong">{t(c.req)}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-4 flex flex-col gap-1.5">
                {CATEGORY_NOTES.map((n) => (
                  <li key={n.en} className="text-[15px] text-ink-strong">· {t(n)}</li>
                ))}
              </ul>
            </div>

            {/* 03 Registration & entry fees */}
            <div id="registration" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "출품 방식 및 사전 심사비" : "Preliminary judging fee"}</SectionH2>
              <dl className={`mt-6 grid gap-px overflow-hidden border border-line bg-line ${REGISTRATION.fees[locale].length > 1 ? "sm:grid-cols-2" : "sm:max-w-[50%]"}`}>
                {REGISTRATION.fees[locale].map((f) => (
                  <div key={f.type} className="bg-white px-5 py-5">
                    <dt className="text-[16px] text-ink-strong">{f.type}</dt>
                    <dd className="mt-1 font-title text-[28px] font-bold text-ink-strong">{f.fee}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-[15px] text-ink-strong">{t(REGISTRATION.feeNote)}</p>
              <p className="mt-6 text-[16px] font-bold text-ink-strong">{t(REGISTRATION.workType)}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {REGISTRATION.rules.map((r) => (
                  <li key={r.en} className="flex gap-2.5 text-[16px] leading-[1.6] text-ink-strong">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                    {t(r)}
                  </li>
                ))}
              </ul>
            </div>

            {/* How to apply — what the application form asks for */}
            <div id="how-to-apply" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "접수 방법 및 준비 항목" : "How to apply & what to prepare"}</SectionH2>
              <p className="mt-4 max-w-[42rem] text-[16px] leading-[1.8] text-ink-strong">{t(HOW_TO_APPLY.intro)}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                {HOW_TO_APPLY.groups.map((g) => (
                  <div key={g.title.en} className="border-t-2 border-brand-blue bg-canvas p-6">
                    <h3 className="text-[18px] font-bold text-ink-strong">{t(g.title)}</h3>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {g.items.map((it) => (
                        <li key={it.en} className="flex gap-2.5 text-[15px] leading-[1.6] text-ink-strong">
                          <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                          {t(it)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 04 Participant benefits */}
            <div id="benefits" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "참가 혜택" : "Participant benefits"}</SectionH2>
              <ol className="mt-6 flex flex-col gap-4">
                {BENEFITS.map((b, i) => (
                  <li key={b.en} className="flex gap-4 text-[16px] leading-[1.6] text-ink-strong">
                    <span className="font-bold text-brand-blue">{String(i + 1).padStart(2, "0")}</span>
                    {t(b)}
                  </li>
                ))}
              </ol>
            </div>

            {/* 05 Final exhibition fee support */}
            <div id="fee-support" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "본선 전시 참가비 지원" : "Final exhibition fee support"}</SectionH2>
              <div className="mt-6 divide-y divide-white/15 bg-[#13294b] px-6 text-white">
                {FEE_SUPPORT.map((s) => (
                  <div key={s.award.en} className="flex flex-wrap items-center justify-between gap-3 py-5">
                    <div>
                      <p className="text-[17px] font-bold uppercase tracking-[0.02em]">{t(s.award)}</p>
                      <p className="mt-1 text-[15px] text-white/80">{t(s.recipients)}</p>
                    </div>
                    <p className="text-[15px] text-white/80">
                      <span className="mr-2 font-title text-[32px] font-bold text-[#d9b25f]">{s.support}</span>
                      {ko ? "참가비 지원" : "fee support"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 06 Key dates */}
            <div id="schedule" className="mt-12 scroll-mt-24 border-t border-line pt-10">
              <SectionH2 ko={ko}>{ko ? "주요 일정" : "Key dates"}</SectionH2>
              <dl className="mt-6 border-t border-line">
                {KEY_DATES.map((row) => (
                  <div key={row.label.en} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4">
                    <dt className="text-[16px] font-semibold text-ink-strong">{t(row.label)}</dt>
                    <dd className="text-[16px] font-bold text-ink-strong">{t(row.value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Notes */}
            <div className="mt-10 border-l-4 border-brand-blue bg-canvas px-5 py-4">
              <ul className="flex flex-col gap-2">
                {NOTES.map((n) => (
                  <li key={n.en} className="text-[15px] leading-[1.7] text-ink-strong">{t(n)}</li>
                ))}
                <li className="text-[15px] leading-[1.7] text-ink-strong">
                  {ko ? "문의" : "Contact"}:{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold underline underline-offset-2">
                    {CONTACT_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Sticky CTA (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[92px] rounded-2xl border border-line bg-white p-6">
              <p className="text-[16px] text-ink-strong">{ko ? "사전 심사비 (작품당)" : "Judging fee (per entry)"}</p>
              <dl className="mt-2 flex flex-col gap-1 text-[15px] text-ink-strong">
                {REGISTRATION.fees[locale].map((f) => (
                  <div key={f.type} className="flex items-baseline justify-between gap-3">
                    <dt>{f.type}</dt>
                    <dd className="shrink-0 font-bold">{f.fee}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-1 text-[16px] text-ink-strong">
                {ko ? "마감 2027.01.15" : "Deadline 15 Jan 2027"}
              </p>
              {applyCta("desktop")}
              <p className="mt-3 text-[15px] leading-[1.6] text-ink-strong">
                {ko ? "Google 계정으로 신청서에 작품 PDF를 업로드합니다." : "Upload your PDF in the application form with a Google account."}
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Sticky CTA (mobile) */}
      <div className="sticky bottom-0 z-40 border-t border-line bg-white px-6 py-3 lg:hidden">
        {applyCta("mobile")}
      </div>
    </>
  );
}
