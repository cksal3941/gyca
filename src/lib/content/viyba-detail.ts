// Structured, bilingual DETAIL content for the VIYBA 2026 competition page.
//
// VIYBA 2026 (Vienna International Youth Book Awards) is the first-launch real
// open call. Source of truth: the official competition guidelines (OFFICIAL
// COMPETITION GUIDELINES deck) provided by the organizer. Entry is a two-stage
// (preliminary / Vienna final) process completed off-site — online application
// via the official form, bank-transfer review fee, and courier delivery of the
// physical book. All three must be confirmed for a preliminary entry to count.
//
// This is Claude-owned structured static *display copy*. Values here mirror the
// published guidelines; nothing is invented.

export type I18n = { en: string; ko: string };

/** Official preliminary-round entry form (online application · STEP 01). */
export const VIYBA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScl8oMz9KT0ViWU99tgWxTjWZpLNBay7cacXMJQ_pzh_pSLIw/viewform";

/** GYCA KakaoTalk channel for inquiries. */
export const VIYBA_KAKAO_URL = "http://pf.kakao.com/_XIQnX";

export const VIYBA_SLUG = "viyba-2026";

/** Preliminary entry deadline as an absolute instant: 7 Nov 2026 24:00 CET
 *  (= 00:00 8 Nov CET = 23:00 UTC; November is CET/UTC+1, no DST). After this
 *  the Apply CTA flips to a "접수 마감" state. */
export const VIYBA_PRELIM_DEADLINE_ISO = "2026-11-07T23:00:00Z";

export const DETAIL_META = {
  eyebrow: { en: "VIYBA 2026 · Vienna", ko: "VIYBA 2026 · 비엔나" } satisfies I18n,
  title: {
    en: "VIYBA 2026 | Vienna International Youth Book Awards",
    ko: "VIYBA 2026 | 비엔나 국제 청소년 북 어워드",
  } satisfies I18n,
  subtitle: {
    en: "International Youth Book Art Competition & Exhibition",
    ko: "국제 청소년 도서예술 공모전 & 전시",
  } satisfies I18n,
  tagline: {
    en: "A book to read. A book to touch. A book as art.",
    ko: "읽고, 만지고, 경험하는 책. 한 권의 책이 하나의 예술작품이 됩니다.",
  } satisfies I18n,
  // Two-line layout: the `\n` is an intentional break (rendered with
  // `whitespace-pre-line`), splitting each sentence into two balanced lines.
  summary: {
    en: "An international youth book-arts competition that regards the very book a child or teenager creates as a work of art —\njudging the whole book, from story and image to editing, materials, binding, structure, and the way a reader experiences it.",
    ko: "VIYBA는 어린이와 청소년이 창작한 ‘책’ 자체를 하나의 예술작품으로 바라보는 국제 청소년 도서예술 공모전입니다.",
  } satisfies I18n,
  host: { en: "Hosted by GYCA × ACCK", ko: "주관 | GYCA × ACCK" } satisfies I18n,
};

// At-a-glance key facts shown under the title, above the tabs — the few things
// a first-time visitor most wants (who / deadline / fee / finals).
export const KEY_FACTS = {
  rows: [
    { label: { en: "Eligibility", ko: "참가 대상" }, value: { en: "Ages 7–18", ko: "만 7~18세" } },
    { label: { en: "Preliminary deadline", ko: "예선 마감" }, value: { en: "7 Nov 2026 (CET)", ko: "2026.11.07 (CET)" } },
    { label: { en: "Preliminary fee", ko: "예선 심사비" }, value: { en: "₩150,000 (group ₩120,000)", ko: "개인 150,000원 (기관 120,000원)" } },
  ] satisfies { label: I18n; value: I18n }[],
} as const;

// § 01 About VIYBA (공모전 소개)
export const ABOUT = {
  title: { en: "About VIYBA", ko: "공모전 소개" } satisfies I18n,
  paragraphs: [
    {
      en: "VIYBA (Vienna International Youth Book Awards) is an international youth book-arts competition that regards the very book a child or teenager creates as a work of art. Rather than judging a single picture or illustration, it evaluates the whole book as one work — story, image, editing, materials, binding, the structure of the book, and the way a reader experiences it.",
      ko: "VIYBA(Vienna International Youth Book Awards)는 어린이와 청소년이 창작한 ‘책(Book)’ 자체를 하나의 예술작품으로 바라보는 국제 청소년 도서예술 공모전입니다. 한 장의 그림이나 일러스트만을 평가하는 것이 아니라 이야기, 이미지, 편집, 재료, 제본, 책의 구조와 독자가 작품을 경험하는 방식까지 한 권의 책 전체를 하나의 작품으로 평가합니다.",
    },
    {
      en: "Regardless of formal publication, you may enter published picture books and art books as well as handmade, pop-up, accordion, and interactive books you drew, made, and bound yourself — book art in many forms.",
      ko: "정식 출판 여부와 관계없이 출간된 그림책과 아트북은 물론 직접 그리고 만들고 제본한 핸드메이드북, 팝업북, 아코디언북, 인터랙티브북 등 다양한 형태의 Book Art 작품을 출품할 수 있습니다.",
    },
  ] satisfies I18n[],
} as const;

// § 02 Eligibility & divisions (참가 대상)
export const ELIGIBILITY = {
  title: { en: "Eligibility", ko: "참가 대상" } satisfies I18n,
  ageNote: {
    en: "Child and teenage creators worldwide, ages 7–18 (age as of 7 Nov 2026).",
    ko: "전 세계 만 7세 이상 18세 이하 어린이·청소년 창작자 (2026년 11월 7일 기준 만 나이)",
  } satisfies I18n,
  divisions: [
    { name: { en: "Junior Division", ko: "JUNIOR DIVISION" }, age: { en: "Age 7–10", ko: "만 7~10세" } },
    { name: { en: "Young Artist Division", ko: "YOUNG ARTIST DIVISION" }, age: { en: "Age 11–14", ko: "만 11~14세" } },
    { name: { en: "Youth Artist Division", ko: "YOUTH ARTIST DIVISION" }, age: { en: "Age 15–18", ko: "만 15~18세" } },
  ] satisfies { name: I18n; age: I18n }[],
  note: {
    en: "Judging considers each division's developmental stage and creative character. Individual and organization/group entries are both accepted.",
    ko: "각 연령 부문의 발달 단계와 창작 특성을 고려하여 심사합니다. 개인접수 및 기관 단체접수가 가능합니다.",
  } satisfies I18n,
} as const;

// § 03 Submission (출품 작품)
export const SUBMISSION = {
  title: { en: "Entry categories", ko: "출품 분야" } satisfies I18n,
  intro: {
    en: "You may enter a finished, physical book planned and created by the child or teenager. It must have a “book structure” the reader can experience through physical interaction — opening, turning, unfolding, or moving its parts.",
    ko: "어린이·청소년이 직접 기획하고 창작한 완성된 실물 도서 형태의 작품을 출품할 수 있습니다. 독자가 손으로 펼치거나, 넘기거나, 열거나, 움직이는 등의 물리적 상호작용을 통해 경험할 수 있는 ‘책의 구조’를 갖추어야 합니다.",
  } satisfies I18n,
  rows: [
    {
      label: { en: "Eligible", ko: "출품 가능" },
      value: {
        en: "Published / Unpublished Picture Book, Artist Book, Handcrafted Book, Hand-bound Book, Pop-up Book, Accordion Book, Fold-out Book, Interactive Book, Sculptural Book, Experimental Book Art, and more",
        ko: "Published / Unpublished Picture Book, Artist Book, Handcrafted Book, Hand-bound Book, Pop-up Book, Accordion Book, Fold-out Book, Interactive Book, Sculptural Book, Experimental Book Art 등",
      },
    },
    {
      label: { en: "Publication", ko: "출판 여부" },
      value: {
        en: "Formal publication status does not affect judging. Even a single handmade book may be entered.",
        ko: "정식 출판 여부는 심사에 영향을 미치지 않습니다. 단 한 권의 핸드메이드북도 출품 가능합니다.",
      },
    },
    {
      label: { en: "Excluded", ko: "출품 제외" },
      value: {
        en: "Loose paintings, illustrations, or posters without a book structure, and works existing only as digital files such as PDF or video.",
        ko: "책의 구조를 갖추지 않은 낱장 회화·일러스트·포스터, PDF·영상 등 디지털 파일만으로 존재하는 작품",
      },
    },
  ] satisfies { label: I18n; value: I18n }[],
} as const;

// § 04 International Selection — preliminary fees & dates (국제 예선)
export const SELECTION = {
  title: { en: "International Selection", ko: "국제 예선" } satisfies I18n,
  rows: [
    { label: { en: "Preliminary deadline", ko: "예선 접수 마감" }, value: { en: "Sat 7 Nov 2026 · 24:00 Vienna Time (CET)", ko: "2026년 11월 7일(토) 24:00 · Vienna Time (CET) 기준" } },
    { label: { en: "Individual entry", ko: "개인접수" }, value: { en: "₩150,000 / per work", ko: "150,000원 / 1작품" } },
    { label: { en: "Organization · group entry", ko: "기관 단체접수" }, value: { en: "₩120,000 / per work · for bulk entry of 3+ from one organization", ko: "120,000원 / 1작품 · 동일 기관 3인 이상 일괄접수 시 적용" } },
    { label: { en: "Preliminary results", ko: "예선 결과 발표" }, value: { en: "Thu 12 Nov 2026", ko: "2026년 11월 12일(목)" } },
  ] satisfies { label: I18n; value: I18n }[],
} as const;

// § 05 How to apply (예선 접수 방법)
export const HOW_TO_APPLY = {
  title: { en: "How to apply", ko: "예선 접수 방법" } satisfies I18n,
  intro: {
    en: "Judging is based on the finished physical book. Entries are accepted by courier only — in-person or on-site submission is not possible.",
    ko: "완성된 실물 도서를 기준으로 심사하며 작품은 택배로만 접수합니다. 방문 및 대면 제출은 불가합니다.",
  } satisfies I18n,
  steps: [
    {
      name: { en: "STEP 01 · Online application", ko: "STEP 01 · 온라인 참가신청" },
      note: { en: "Enter participant and work details on the official VIYBA preliminary entry page.", ko: "VIYBA 공식 예선 접수 페이지에서 참가자 정보 및 작품 정보를 입력합니다." },
    },
    {
      name: { en: "STEP 02 · Pay the review fee", ko: "STEP 02 · 예선 심사비 입금" },
      note: { en: "KB Bank 464801-01-222626 · Account holder: 글로벌영크리에이트어워드 · Individual ₩150,000 / Organization·group ₩120,000 (per work).", ko: "국민은행 464801-01-222626 · 예금주 글로벌영크리에이트어워드 · 개인 150,000원 / 기관 단체 120,000원(1작품)" },
    },
    {
      name: { en: "STEP 03 · Ship the physical book", ko: "STEP 03 · 실물 작품 택배 발송" },
      note: { en: "VIYBA / GYCA receiving point, 201, Yujin Bldg, 7 Seochojungang-ro 33-gil, Seocho-gu, Seoul. Courier only — no in-person submission. The entrant covers shipping to the domestic receiving point.", ko: "서울특별시 서초구 서초중앙로33길 7 유진빌딩 201호 · VIYBA / GYCA 접수처 · 택배 접수만 가능하며 방문·대면 제출은 불가합니다. 국내 접수처까지의 발송비는 출품자 부담입니다." },
    },
    {
      name: { en: "STEP 04 · Final entry confirmation", ko: "STEP 04 · 최종 예선접수 확인" },
      note: { en: "A preliminary entry is final only when online application + fee payment + physical arrival are all confirmed. Be sure to check the “VIYBA preliminary entry complete” message sent by GYCA.", ko: "온라인 신청 + 심사비 입금 + 실물 작품 택배 도착이 모두 확인되어야 최종 예선접수가 완료됩니다. GYCA에서 발송하는 「VIYBA 예선접수 완료」 안내 메시지를 반드시 확인해주시기 바랍니다." },
    },
  ],
} as const;

// § 06 Individual Evaluation Report (모든 출품자 제공)
export const EVALUATION = {
  title: { en: "Evaluation report", ko: "평가 리포트" } satisfies I18n,
  intro: {
    en: "Every properly completed preliminary entry receives a VIYBA Individual Evaluation Report.",
    ko: "정상적으로 예선접수가 완료된 모든 출품자에게 VIYBA Individual Evaluation Report를 제공합니다.",
  } satisfies I18n,
  criteria: [
    { label: { en: "Originality", ko: "ORIGINALITY" }, note: { en: "독창성", ko: "독창성" } },
    { label: { en: "Book as Art", ko: "BOOK AS ART" }, note: { en: "Structure & artistry of the book", ko: "책의 구조와 예술성" } },
    { label: { en: "Visual Expression", ko: "VISUAL EXPRESSION" }, note: { en: "Visual expression", ko: "시각적 표현" } },
    { label: { en: "Storytelling", ko: "STORYTELLING" }, note: { en: "Storytelling", ko: "스토리텔링" } },
  ] satisfies { label: I18n; note: I18n }[],
  note: {
    en: "Along with each work's result, a Jury Comment on its strengths and potential is provided. The report is given to every properly submitted work, whether or not it passes the preliminary round.",
    ko: "각 작품의 평가 결과와 함께 작품의 강점과 발전 가능성을 담은 Jury Comment를 제공합니다. 평가리포트는 예선 통과 여부와 관계없이 모든 정상 접수 작품에 제공됩니다.",
  } satisfies I18n,
} as const;

// § 07 Official Selection (예선 통과자)
export const OFFICIAL_SELECTION = {
  title: { en: "Official Selection", ko: "예선 선정" } satisfies I18n,
  intro: {
    en: "Works that pass the international preliminary review are officially named VIYBA Official Selection / VIYBA Selected Book.",
    ko: "국제 예선 심사를 통과한 작품은 VIYBA OFFICIAL SELECTION / VIYBA SELECTED BOOK으로 공식 선정됩니다.",
  } satisfies I18n,
  items: [
    { label: { en: "Official Selection", ko: "OFFICIAL SELECTION" }, value: { en: "Named a VIYBA Official Selection", ko: "VIYBA Official Selection 선정" } },
    { label: { en: "Certificate", ko: "CERTIFICATE" }, value: { en: "Official VIYBA Selected Book certificate issued", ko: "VIYBA Selected Book 공식 인증서 발급" } },
    { label: { en: "Final eligibility", ko: "FINAL ELIGIBILITY" }, value: { en: "Qualification to advance to the Vienna Final", ko: "Vienna Final 본선 진출 자격 부여" } },
  ] satisfies { label: I18n; value: I18n }[],
} as const;

// Scholarships for top preliminary entrants (예선 우수 참가자 장학 혜택)
export const SCHOLARSHIPS = {
  title: { en: "Scholarships for top entrants", ko: "예선 우수 참가자 장학 혜택" } satisfies I18n,
  items: [
    { rank: { en: "Preliminary 1st", ko: "예선 1위" }, award: { en: "100% of the finals entry fee covered", ko: "본선 참가비 100% 전액 지원" } },
    { rank: { en: "Preliminary 2nd–4th", ko: "예선 2~4위" }, award: { en: "30% scholarship on the finals entry fee", ko: "본선 참가비 30% 장학금 지원" } },
  ] satisfies { rank: I18n; award: I18n }[],
  note: { en: "Scholarships apply to the finals entry fee.", ko: "장학 혜택은 본선 참가비에 적용됩니다." } satisfies I18n,
} as const;

// Finals benefits (본선 참가 혜택)
export const FINALS_BENEFITS = {
  title: { en: "Finals benefits", ko: "본선 참가 혜택" } satisfies I18n,
  items: [
    { en: "On-site exhibition of finalist books in Vienna", ko: "비엔나 현지 본선 진출작 실물 도서 전시" },
    { en: "International finals judging and an official certificate", ko: "국제 본선 심사 및 공식 인증서" },
    { en: "On-site awards ceremony and an artist book talk", ko: "현지 시상식 및 작가 북토크" },
    { en: "Exhibition photos, video, and an artist archive", ko: "전시 사진·영상 및 작가 아카이브" },
    { en: "International round-trip shipping and damage insurance included", ko: "작품 국제 왕복 운송 및 파손보험 포함" },
  ] satisfies I18n[],
  note: { en: "※ For registered finalists; the finals entry fee (₩1,900,000) is separate.", ko: "※ 본선 등록자 대상이며, 본선 참가비(1,900,000원)는 별도입니다." } satisfies I18n,
} as const;

// Vienna on-site event (비엔나 현지 행사)
export const VIENNA_EVENT = {
  title: { en: "Vienna on-site event", ko: "비엔나 현지 행사" } satisfies I18n,
  facts: [
    { label: { en: "Dates", ko: "일정" }, value: { en: "14–16 December 2026", ko: "2026년 12월 14일~16일" } },
    { label: { en: "Venue", ko: "장소" }, value: { en: "Music and Art · Vienna, Austria", ko: "Music and Art · Vienna, Austria" } },
    { label: { en: "Program", ko: "프로그램" }, value: { en: "Finals exhibition · Awards ceremony · Artist book talk", ko: "본선 전시 · 시상식 · 작가 북토크" } },
  ] satisfies { label: I18n; value: I18n }[],
} as const;

// Key dates (주요 일정) — full two-stage timeline from the guidelines deck.
export const KEY_DATES = {
  title: { en: "Schedule", ko: "접수 일정" } satisfies I18n,
  timezoneNote: {
    en: "Deadlines are shown in Vienna local time (CET).",
    ko: "마감 시각은 비엔나 현지 시간(CET) 기준입니다.",
  } satisfies I18n,
  rows: [
    { label: { en: "Preliminary entry deadline", ko: "예선 접수 마감" }, value: { en: "7 Nov 2026 · 24:00 CET", ko: "2026.11.07 · 24:00 CET" } },
    { label: { en: "Preliminary results", ko: "예선 결과 발표" }, value: { en: "12 Nov 2026", ko: "2026.11.12" } },
    { label: { en: "Finals registration deadline", ko: "본선 등록 마감" }, value: { en: "20 Nov 2026 · 24:00 CET", ko: "2026.11.20 · 24:00 CET" } },
    { label: { en: "Vienna Final", ko: "비엔나 본선" }, value: { en: "14–16 Dec 2026", ko: "2026.12.14–16" } },
  ],
} as const;

// Fees at a glance (참가비)
export const FEES = {
  title: { en: "Fees", ko: "참가비" } satisfies I18n,
  rows: [
    { label: { en: "Preliminary · individual", ko: "예선 · 개인접수" }, value: { en: "₩150,000 / per work", ko: "150,000원 / 1작품" } },
    { label: { en: "Preliminary · organization·group", ko: "예선 · 기관 단체접수" }, value: { en: "₩120,000 / per work", ko: "120,000원 / 1작품" } },
    { label: { en: "Finals entry fee", ko: "본선 참가비" }, value: { en: "₩1,900,000", ko: "1,900,000원" } },
  ] satisfies { label: I18n; value: I18n }[],
  note: {
    en: "The preliminary review fee is paid by bank transfer at entry. The finals entry fee is separate and applies only to registered finalists.",
    ko: "예선 심사비는 접수 시 계좌 입금합니다. 본선 참가비는 별도이며 본선 등록자에게만 적용됩니다.",
  } satisfies I18n,
} as const;

// § 08 Application & contact (접수 및 문의)
export const CONTACT = {
  title: { en: "Application & contact", ko: "접수 및 문의" } satisfies I18n,
  formLabel: { en: "Preliminary online entry", ko: "예선 온라인 접수" } satisfies I18n,
  formUrl: VIYBA_FORM_URL,
  kakaoLabel: { en: "Inquiries (KakaoTalk channel)", ko: "예선접수 문의 (카카오톡 채널)" } satisfies I18n,
  kakaoUrl: VIYBA_KAKAO_URL,
  rows: [
    { label: { en: "Review-fee account", ko: "예선 심사비 계좌" }, value: { en: "KB Bank 464801-01-222626 · Account holder: 글로벌영크리에이트어워드", ko: "국민은행 464801-01-222626 · 예금주 글로벌영크리에이트어워드" } },
    { label: { en: "Physical receiving point", ko: "실물 작품 접수처" }, value: { en: "201, Yujin Bldg, 7 Seochojungang-ro 33-gil, Seocho-gu, Seoul · VIYBA / GYCA receiving point", ko: "서울특별시 서초구 서초중앙로33길 7 유진빌딩 201호 · VIYBA / GYCA 접수처" } },
    { label: { en: "Method", ko: "접수 방식" }, value: { en: "Courier only · no in-person or on-site submission", ko: "택배 접수만 가능 · 방문 및 대면 제출 불가" } },
    { label: { en: "Final confirmation", ko: "최종 확인" }, value: { en: "After online application + payment + arrival are confirmed, check GYCA's “VIYBA preliminary entry complete” message", ko: "온라인 신청 + 입금 + 작품 도착 확인 후 GYCA 「VIYBA 예선접수 완료」 메시지 확인" } },
  ] satisfies { label: I18n; value: I18n }[],
} as const;
