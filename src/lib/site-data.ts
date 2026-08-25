// Sample content for the GYCA site, modelled on the UX spec's categories,
// statuses and global stages. Replace with real data / CMS later.

export type ContestStatus =
  | "upcoming"
  | "open"
  | "judging"
  | "result"
  | "closed";

export const STATUS_LABEL: Record<ContestStatus, string> = {
  upcoming: "접수 예정",
  open: "접수 중",
  judging: "심사 중",
  result: "결과 발표",
  closed: "종료",
};

export const STATUS_COLOR: Record<ContestStatus, string> = {
  upcoming: "bg-neutral-400",
  open: "bg-brand-teal",
  judging: "bg-brand-purple",
  result: "bg-brand-blue",
  closed: "bg-neutral-300",
};

export const CONTEST_FILTERS = [
  "전체",
  "도서·일러스트",
  "미술",
  "음악·공연",
  "UX·기술",
  "비즈니스",
] as const;

export type Contest = {
  slug: string;
  title: string;
  titleEn: string;
  category: (typeof CONTEST_FILTERS)[number];
  categoryEn: string;
  city: string;
  stage: string;
  period: string;
  deadline: string;
  status: ContestStatus;
  fee: string;
  summary: string;
  tint: string;
};

export const CONTESTS: Contest[] = [
  {
    slug: "young-authors-award-2026",
    title: "International Young Authors Award",
    titleEn: "Book & Illustration",
    category: "도서·일러스트",
    categoryEn: "BOOK & ILLUSTRATION",
    city: "Frankfurt",
    stage: "프랑크푸르트 도서전 연계",
    period: "2026.05.06 ~ 07.15",
    deadline: "2026.07.15",
    status: "open",
    fee: "₩60,000",
    summary:
      "도서·일러스트 분야 국제 청소년 공모전. 수상작은 프랑크푸르트 도서전 연계 프로그램에 소개됩니다.",
    tint: "linear-gradient(135deg,#efd189,#c68f2c)",
  },
  {
    slug: "art-for-tomorrow-2026",
    title: "Art for Tomorrow Challenge",
    titleEn: "Art & Social Impact",
    category: "미술",
    categoryEn: "ART & SOCIAL IMPACT",
    city: "Seoul",
    stage: "서울 및 국제 순회전",
    period: "2026.03.04 ~ 06.20",
    deadline: "2026.06.20",
    status: "open",
    fee: "₩50,000",
    summary:
      "사회적 메시지를 담은 미술 창작 공모전. 우수작은 서울 및 국제 순회 전시로 이어집니다.",
    tint: "linear-gradient(135deg,#a8dcd0,#8fb6f0)",
  },
  {
    slug: "music-performance-award-2026",
    title: "Music & Performance Award",
    titleEn: "Music & Performance",
    category: "음악·공연",
    categoryEn: "MUSIC & PERFORMANCE",
    city: "Spoleto",
    stage: "스폴레토 페스티벌 연계",
    period: "2026.06.01 ~ 08.30",
    deadline: "2026.08.30",
    status: "upcoming",
    fee: "₩70,000",
    summary:
      "음악·공연 분야 청소년 공모전. 본선 진출자는 스폴레토 페스티벌 무대에 초청됩니다.",
    tint: "linear-gradient(135deg,#7a4b2b,#1b1b1b)",
  },
  {
    slug: "young-innovators-2025",
    title: "Young Innovators Business Challenge",
    titleEn: "Business & Technology",
    category: "비즈니스",
    categoryEn: "BUSINESS & TECHNOLOGY",
    city: "USA",
    stage: "글로벌 쇼케이스",
    period: "2025.06.01 ~ 08.30",
    deadline: "2025.08.30",
    status: "closed",
    fee: "₩70,000",
    summary:
      "비즈니스·기술 아이디어 챌린지. 최종 선발 팀은 미국 글로벌 쇼케이스에 참가합니다.",
    tint: "linear-gradient(135deg,#e6e6e6,#a6a6a6)",
  },
];

export const GLOBAL_STAGES = [
  { city: "Frankfurt", note: "도서·일러스트 본선" },
  { city: "Spoleto", note: "음악·공연 본선" },
  { city: "Seoul", note: "미술 순회전" },
  { city: "USA", note: "글로벌 쇼케이스" },
];

export const EXHIBITION_FILTERS = [
  "전체",
  "프랑크푸르트",
  "스폴레토",
  "뉴욕",
  "서울",
  "미국",
] as const;

export type Exhibition = {
  slug: string;
  title: string;
  city: (typeof EXHIBITION_FILTERS)[number];
  date: string;
  type: "전시" | "공연";
  summary: string;
  tint: string;
};

export const EXHIBITIONS: Exhibition[] = [
  {
    slug: "seoul-touring-2026",
    title: "2026 Art for Tomorrow 서울 순회전",
    city: "서울",
    date: "2026.09.10 ~ 09.24",
    type: "전시",
    summary: "수상작 및 초청작 전시. 인사동 마루아트센터 특별관.",
    tint: "linear-gradient(135deg,#a8dcd0,#f4c7cf)",
  },
  {
    slug: "spoleto-stage-2026",
    title: "Spoleto Youth Performance Night",
    city: "스폴레토",
    date: "2026.10.02",
    type: "공연",
    summary: "음악·공연 본선 진출자 무대. 스폴레토 페스티벌 연계.",
    tint: "linear-gradient(135deg,#6b4326,#161616)",
  },
  {
    slug: "newyork-exhibition-2025",
    title: "2025 IYAC New York Exhibition",
    city: "뉴욕",
    date: "2025.11.05 ~ 11.19",
    type: "전시",
    summary: "뉴욕 맨해튼 Detour Gallery 수상작 전시.",
    tint: "linear-gradient(135deg,#7a4b2b,#1b1b1b)",
  },
];

export type Winner = {
  slug: string;
  title: string;
  artist: string;
  award: "Grand Prize" | "Gold" | "Silver" | "Bronze" | "Finalist";
  category: string;
  year: string;
  country: string;
  tint: string;
};

export const WINNER_YEARS = ["전체", "2026", "2025"] as const;
export const AWARD_LEVELS = [
  "전체",
  "Grand Prize",
  "Gold",
  "Silver",
  "Bronze",
  "Finalist",
] as const;

export const WINNERS: Winner[] = [
  {
    slug: "quiet-morning",
    title: "Quiet Morning",
    artist: "김서연",
    award: "Grand Prize",
    category: "도서·일러스트",
    year: "2026",
    country: "KR",
    tint: "linear-gradient(135deg,#efd189,#c68f2c)",
  },
  {
    slug: "city-of-light",
    title: "City of Light",
    artist: "David Park",
    award: "Gold",
    category: "미술",
    year: "2026",
    country: "US",
    tint: "linear-gradient(135deg,#a8dcd0,#8fb6f0)",
  },
  {
    slug: "resonance",
    title: "Resonance",
    artist: "이준호",
    award: "Silver",
    category: "음악·공연",
    year: "2025",
    country: "KR",
    tint: "linear-gradient(135deg,#7a4b2b,#1b1b1b)",
  },
  {
    slug: "next-step",
    title: "Next Step",
    artist: "Team Aurora",
    award: "Finalist",
    category: "비즈니스",
    year: "2025",
    country: "KR",
    tint: "linear-gradient(135deg,#e6e6e6,#a6a6a6)",
  },
];

export type Notice = {
  slug: string;
  category: "공지" | "일정" | "FAQ";
  title: string;
  date: string;
  body: string;
};

export const NOTICE_FILTERS = ["전체", "공지", "일정", "FAQ"] as const;

export const NOTICES: Notice[] = [
  {
    slug: "2026-schedule",
    category: "일정",
    title: "2026 GYCA 공모전 전체 일정 안내",
    date: "2026.02.01",
    body: "2026년 각 부문 공모전의 접수·심사·결과 발표 일정을 안내드립니다.",
  },
  {
    slug: "submission-guide",
    category: "공지",
    title: "작품 접수 방법 및 제출 규격 안내",
    date: "2026.02.10",
    body: "이미지·PDF·영상·음원 등 부문별 제출 규격과 접수 절차를 확인하세요.",
  },
  {
    slug: "faq-payment",
    category: "FAQ",
    title: "참가비 결제와 환불 규정은 어떻게 되나요?",
    date: "2026.02.12",
    body: "참가비 결제 방법, 환불 가능 기간, 접수 취소 절차를 안내합니다.",
  },
];

export function getContest(slug: string) {
  return CONTESTS.find((c) => c.slug === slug);
}

export function getExhibition(slug: string) {
  return EXHIBITIONS.find((e) => e.slug === slug);
}

export function getWinner(slug: string) {
  return WINNERS.find((w) => w.slug === slug);
}

export function getNotice(slug: string) {
  return NOTICES.find((n) => n.slug === slug);
}

export const AWARD_COLOR: Record<Winner["award"], string> = {
  "Grand Prize": "bg-brand-blue",
  Gold: "bg-amber-500",
  Silver: "bg-neutral-400",
  Bronze: "bg-amber-700",
  Finalist: "bg-brand-teal",
};
