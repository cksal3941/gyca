// Central SEO configuration. Values here feed the root metadata, JSON-LD, the
// sitemap, and robots. Korean + English are both represented so the site is
// discoverable domestically (Naver/Google KR) and internationally (GEO).
//
// Set NEXT_PUBLIC_SITE_URL to the production origin (e.g. https://www.gyca.org)
// at build time. The fallback is used for local/preview builds.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gyca.org").replace(/\/$/, "");

export const SITE_NAME = {
  en: "GYCA — Global Young Creators Award",
  ko: "GYCA 글로벌영크리에이트",
} as const;

export const SITE_TITLE = {
  en: "GYCA — International Youth Art & Book Awards",
  ko: "GYCA — 국제 청소년 아트·도서 공모전",
} as const;

export const SITE_DESCRIPTION = {
  en: "GYCA (Global Young Creators Award) runs international competitions and exhibitions for young creators aged 7–18 — including VIYBA, the Vienna International Youth Book Awards. Enter art books, picture books, and creative works and grow on a global stage.",
  ko: "GYCA(글로벌영크리에이트)는 만 7~18세 청소년을 위한 국제 공모전과 전시를 운영합니다. 비엔나 국제 청소년 북 어워드(VIYBA)를 비롯해 아트북·그림책·창작 작품을 접수하고, 국제 무대에서 성장할 기회를 제공합니다.",
} as const;

// Dual-language keyword set — broad coverage for KR and global search.
export const SITE_KEYWORDS = [
  // English
  "GYCA",
  "Global Young Creators Award",
  "VIYBA",
  "Vienna International Youth Book Awards",
  "international youth art competition",
  "youth book awards",
  "art book competition",
  "children's picture book contest",
  "young creators",
  "handmade book contest",
  "youth art exhibition",
  // Korean
  "국제 청소년 공모전",
  "청소년 아트북 공모전",
  "도서예술 공모전",
  "비엔나 국제 청소년 북 어워드",
  "청소년 미술 공모전",
  "어린이 그림책 공모전",
  "핸드메이드북 공모전",
  "청소년 창작 공모전",
  "글로벌영크리에이트",
  "청소년 국제 전시",
];

/** og:locale value per app locale. */
export const OG_LOCALE = { en: "en_US", ko: "ko_KR" } as const;

export const ORG_EMAIL = "admin@gyca.org";
export const ORG_INSTAGRAM = "https://www.instagram.com/gyca.official";

/** Organization JSON-LD — identity for Google/Naver knowledge panels + GEO. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "GYCA (Global Young Creators Award)",
    alternateName: ["GYCA", "글로벌영크리에이트", "Global Young Creators Award"],
    url: SITE_URL,
    logo: `${SITE_URL}/images/gyca_logo.png`,
    email: ORG_EMAIL,
    sameAs: [ORG_INSTAGRAM],
    address: {
      "@type": "PostalAddress",
      streetAddress: "201, Yujin Bldg, 7 Seochojungang-ro 33-gil, Seocho-gu",
      addressLocality: "Seoul",
      addressCountry: "KR",
    },
  };
}

/** WebSite JSON-LD — site-level identity. */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME.en,
    alternateName: SITE_NAME.ko,
    url: SITE_URL,
    inLanguage: ["en", "ko"],
  };
}
