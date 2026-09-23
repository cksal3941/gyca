// Klimt Villa — completed project ARCHIVE content (brief §3 ①–⑩).
//
// This is the *data* for the reusable ProjectArchive model in `./archive.ts`.
// Framing copy (what each area is about) is written where it can be stated
// truthfully. Actual photos, buyer interviews, sale amounts, certificate scans,
// and result figures are NOT invented — those sections are `status: "pending"`
// with a note describing what real material belongs there. Provide the material
// (or wire a CMS) to flip a section to `status: "ready"`.

import type { ProjectArchive } from "./archive";

export const KLIMT_VILLA: ProjectArchive = {
  slug: "klimt-villa",
  status: "completed",
  hero: {
    eyebrow: { en: "Archive", ko: "Archive" },
    program: { en: "Klimt Villa Youth Art Project", ko: "클림트 빌라 청소년 아트 프로젝트" },
    location: { en: "Vienna, Austria", ko: "오스트리아 비엔나" },
    // Exact dates are a CMS field — not fabricated here.
    period: { en: "Completed", ko: "완료" },
    summary: {
      en: "A completed GYCA project at the Klimt Villa in Vienna.",
      ko: "비엔나 클림트 빌라에서 진행된 GYCA 완료 프로젝트입니다.",
    },
    operated: [
      { en: "Exhibition", ko: "전시" },
      { en: "Awards ceremony", ko: "수여식" },
      { en: "Artwork sales", ko: "작품 판매" },
      { en: "Certificates", ko: "인증서" },
    ],
    // Optional hero photo (unused by the current editorial header). Provide an
    // approved Klimt Villa photograph to enable an image hero later.
    image: { src: null, alt: { en: "Klimt Villa, Vienna", ko: "비엔나 클림트 빌라" } },
  },

  sections: [
    // ① Project introduction — safe to describe truthfully.
    {
      kind: "intro",
      order: 1,
      title: { en: "About the project", ko: "프로젝트 소개" },
      status: "ready",
      intro: {
        en: "GYCA brought young creators' work to the Klimt Villa in Vienna, a historic setting tied to Gustav Klimt. The project connected an open call for youth work to a real, curated exhibition and a public program.",
        ko: "GYCA는 청소년 창작자의 작품을 구스타프 클림트와 연고가 있는 비엔나 클림트 빌라에서 선보였습니다. 청소년 공모를 실제 큐레이션 전시와 공개 프로그램으로 연결한 프로젝트입니다.",
      },
    },

    // ② Open call & selection process — describe the process, not fake outcomes.
    {
      kind: "process",
      order: 2,
      title: { en: "Open call & selection", ko: "공모 및 선정 과정" },
      status: "ready",
      intro: {
        en: "Works were gathered through an open call and reviewed for the exhibition. Selected creators were invited to show their work and receive certificates.",
        ko: "작품은 공모를 통해 접수되었고 전시를 위한 심사를 거쳤습니다. 선정된 창작자는 작품 전시와 인증서 발급 대상이 되었습니다.",
      },
    },

    // ③ Selected works — real work images/titles required; pending until provided.
    {
      kind: "selection",
      order: 3,
      title: { en: "Selected works", ko: "선정작 소개" },
      status: "pending",
      intro: {
        en: "The works chosen for the Klimt Villa exhibition.",
        ko: "클림트 빌라 전시에 선정된 작품들입니다.",
      },
      gallery: [{ src: null }],
      pendingNote: {
        en: "Selected work images, titles, and creator names will appear here.",
        ko: "선정작 이미지·작품명·창작자명이 이곳에 표시됩니다.",
      },
    },

    // ④ Vienna exhibition photos — real photography required.
    {
      kind: "exhibition_photos",
      order: 4,
      title: { en: "Exhibition in Vienna", ko: "비엔나 전시 현장" },
      status: "pending",
      intro: {
        en: "Photographs from the exhibition at the Klimt Villa.",
        ko: "클림트 빌라 전시 현장 사진입니다.",
      },
      gallery: [{ src: null }, { src: null }, { src: null }],
      pendingNote: {
        en: "Exhibition installation and visitor photos will appear here.",
        ko: "전시 설치·관람 현장 사진이 이곳에 표시됩니다.",
      },
    },

    // ⑤ Awards ceremony photos — real photography required.
    {
      kind: "ceremony_photos",
      order: 5,
      title: { en: "Awards ceremony", ko: "수여식" },
      status: "pending",
      intro: {
        en: "Photographs from the awards ceremony.",
        ko: "수여식 현장 사진입니다.",
      },
      gallery: [{ src: null }, { src: null }],
      pendingNote: {
        en: "Ceremony and certificate-presentation photos will appear here.",
        ko: "수여식·인증서 전달 사진이 이곳에 표시됩니다.",
      },
    },

    // ⑥ Artwork sales cases — no invented amounts; pending until real cases exist.
    {
      kind: "sales",
      order: 6,
      title: { en: "Artwork sales", ko: "작품 판매 사례" },
      status: "pending",
      intro: {
        en: "Cases where exhibited works found buyers.",
        ko: "전시 작품이 구매로 이어진 사례입니다.",
      },
      stats: [{ label: { en: "Works sold", ko: "판매 작품" }, value: null }],
      pendingNote: {
        en: "Confirmed sale cases (work, context) will appear here. No amounts are shown until confirmed.",
        ko: "확인된 판매 사례(작품·정황)가 이곳에 표시됩니다. 확정 전에는 금액을 표시하지 않습니다.",
      },
    },

    // ⑦ Buyer interviews — only real, consented quotes. Optional: hidden if none.
    {
      kind: "buyer_interviews",
      order: 7,
      title: { en: "Buyer interviews", ko: "작품 구매자 인터뷰" },
      status: "pending",
      // `optional: true` here would hide this area entirely when empty (the
      // reusable mechanism). Kept visible so all ten Klimt areas are represented;
      // other programs can flip it on.
      intro: {
        en: "Interviews with people who bought the works.",
        ko: "작품을 구매한 분들과의 인터뷰입니다.",
      },
      quotes: [],
      pendingNote: {
        en: "Consented buyer interviews will appear here.",
        ko: "동의를 받은 구매자 인터뷰가 이곳에 표시됩니다.",
      },
    },

    // ⑧ Exhibition certificate — real scan/sample required.
    {
      kind: "exhibition_certificate",
      order: 8,
      title: { en: "Exhibition certificate", ko: "전시 인증서" },
      status: "pending",
      intro: {
        en: "The certificate issued for exhibited works.",
        ko: "전시 작품에 발급된 인증서입니다.",
      },
      documents: [{ src: null }],
      pendingNote: {
        en: "A sample exhibition certificate will appear here.",
        ko: "전시 인증서 샘플이 이곳에 표시됩니다.",
      },
    },

    // ⑨ Sales certificate — real scan/sample required.
    {
      kind: "sales_certificate",
      order: 9,
      title: { en: "Sales certificate", ko: "판매 인증서" },
      status: "pending",
      intro: {
        en: "The certificate issued for sold works.",
        ko: "판매된 작품에 발급된 인증서입니다.",
      },
      documents: [{ src: null }],
      pendingNote: {
        en: "A sample sales certificate will appear here.",
        ko: "판매 인증서 샘플이 이곳에 표시됩니다.",
      },
    },

    // ⑩ Project results & achievements — no fabricated figures.
    {
      kind: "results",
      order: 10,
      title: { en: "Results & outcomes", ko: "프로젝트 결과 및 주요 실적" },
      status: "pending",
      intro: {
        en: "What the project achieved overall.",
        ko: "프로젝트가 거둔 전반적인 성과입니다.",
      },
      stats: [
        { label: { en: "Works exhibited", ko: "전시 작품 수" }, value: null },
        { label: { en: "Participating creators", ko: "참여 창작자" }, value: null },
        { label: { en: "Works sold", ko: "판매 작품 수" }, value: null },
      ],
      pendingNote: {
        en: "Confirmed outcome figures will appear here once verified.",
        ko: "확인된 실적 수치가 검증 후 이곳에 표시됩니다.",
      },
    },
  ],
};
