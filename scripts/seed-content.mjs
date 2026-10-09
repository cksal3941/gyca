// 홈페이지에 하드코딩되어 있던 콘텐츠를 DB로 옮기는 시드 스크립트.
// 각 테이블이 비어 있을 때만 삽입하므로 여러 번 실행해도 안전하다.
// 사용법: node --env-file=.env.local scripts/seed-content.mjs
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CONTESTS = [
  {
    latest: true,
    status: "open",
    period: "2026.05.06 ~ 07.15",
    titleLines: ["2026 6TH IYAC 글로벌", "청소년 미술 대회"],
    description:
      "뉴욕 대형 갤러리 Detour Gallery 수상작 전시 참여 기회가 제공되었으며, 우수한 성적을 작품은 미국 뉴저지 상원의원상 수여 및 코엑스 대형 스크린 전시가 진행 됩니다.",
    posters: [
      "https://picsum.photos/seed/poster-global-art/447/632",
      "https://picsum.photos/seed/poster-iyac-junior/447/632",
      "https://picsum.photos/seed/poster-iyac-3/447/632",
    ],
  },
  {
    latest: true,
    status: "open",
    period: "2026.03.04 ~ 06.20",
    titleLines: ["2026 KAJAA 한국 청소년", "아트 페스티벌"],
    description:
      "대한민국 청소년 창작 미술 대회. 도심 LED 스크린 송출과 오프라인 전시가 함께 진행되며, 우수작은 글로벌 무대로 이어집니다.",
    posters: [
      "https://picsum.photos/seed/poster-kajaa-1/447/632",
      "https://picsum.photos/seed/poster-kajaa-2/447/632",
      "https://picsum.photos/seed/poster-kajaa-3/447/632",
    ],
  },
  {
    latest: false,
    status: "close",
    period: "2025.06.01 ~ 08.30",
    titleLines: ["2025 IYAC Global", "Youth Art Contest"],
    description:
      "전 세계 청소년 예술가들이 참여한 글로벌 아트 콘테스트. 뉴욕 Detour Gallery 전시로 마무리되었습니다.",
    posters: [
      "https://picsum.photos/seed/poster-2025-1/447/632",
      "https://picsum.photos/seed/poster-2025-2/447/632",
      "https://picsum.photos/seed/poster-2025-3/447/632",
    ],
  },
];

const NEWS = [
  {
    tag: "결과 공지",
    tagColor: "text-brand-orange",
    title: "2026 IYAC Global Art Contest 최종 결과 발표",
    date: "2026-08-08",
  },
  {
    tag: null,
    tagColor: null,
    title: "2026 KAJAA 아트페스티벌, 성공적인 개최와 아름다운 마무리",
    date: "2026-09-10",
  },
  {
    tag: "대회 개최",
    tagColor: "text-brand-blue",
    title: "2026 6th IYAC Global Youth Art Contest 개최",
    date: "2026-05-06",
  },
  {
    tag: "대회 개최",
    tagColor: "text-brand-blue",
    title: "2026 카쟈: 한국 청소년 아트 페스티벌 개최",
    date: "2026-03-04",
  },
  {
    tag: "공지 사항",
    tagColor: "text-neutral-500",
    title: "2026 6th IYAC Global Youth Art Contest 주제 및 일정 안내",
    date: "2025-11-03",
  },
];

const MEDIA = [
  {
    cat: "인터뷰",
    title: "IYAC 심사위원 Dale Clifford 인터뷰",
    sub: "심사위원 Dale Clifford 인터뷰 (前 SCAD 교수님 / AP 미술 수석 채점관)",
    image: "https://picsum.photos/seed/media-dale/640/400",
  },
  {
    cat: "미디어",
    title: "2025 카쟈아트페스티벌 전광판 송출",
    sub: "서울 삼성역 근처 옥택스 미디어(옥외 파리스크 미디어)&외 우수작 송출",
    image: "https://picsum.photos/seed/media-billboard/640/400",
  },
  {
    cat: "인터뷰",
    title: "2025 IYAC 은상 수상자 인터뷰 영상",
    sub: "2025 SVA 심가 / 2025 IYAC 수상자 강남 학원가 글로벌 무대 도전기",
    image: "https://picsum.photos/seed/media-interview/640/400",
  },
];

const PROJECTS = [
  {
    badge: "예필로그",
    titleLines: ["2026 카쟈: 한국 청소년 아트", "페스티벌 전시회"],
    description:
      "마이슬라이드가 주최한 2026 카쟈 청소년 미술 대회의 1차 수상작들을 이어가던 전시회이며, 서울 인사동에 위치고 하고 있는 마루아트센터 특별관 에서 진행되었습니다. 컬러 세계 · 스타일로 · 회의워클 · 밀알복지재단이 함께 했습니다.",
    image: "https://picsum.photos/seed/graffiti-kid/900/900",
    links: ["예필로그", "수상작", "공고보기"],
    reverse: false,
  },
  {
    badge: "예필로그",
    titleLines: ["2025 IYAC GLOBAL YOUTH ART CONTEST", "NEW YORK EXHIBITION"],
    description:
      "전 세계적으로 진행된 청소년 미술 대회의 1차 수상작들을 이어가던 전시회이며, 뉴욕 맨해튼에 위치 하고 있는 Detour Gallery 에서 진행되었습니다. 분선에서 최종 선발된 5작품은 미국 뉴저지 상설전용관이 수여됩니다.",
    image: "https://picsum.photos/seed/ny-street-building/900/900",
    links: ["예필로그", "수상작", "공고보기"],
    reverse: true,
  },
];

async function isEmpty(table) {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM "${table}"`);
  return rows[0].n === 0;
}

if (await isEmpty("contests")) {
  for (const [i, c] of CONTESTS.entries()) {
    await pool.query(
      `INSERT INTO contests (title_lines, description, period, status, latest, posters, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [c.titleLines, c.description, c.period, c.status, c.latest, c.posters, i],
    );
  }
  console.log(`contests: ${CONTESTS.length}건 삽입`);
} else {
  console.log("contests: 데이터가 있어 건너뜀");
}

if (await isEmpty("news")) {
  for (const n of NEWS) {
    await pool.query(
      `INSERT INTO news (tag, tag_color, title, date) VALUES ($1, $2, $3, $4)`,
      [n.tag, n.tagColor, n.title, n.date],
    );
  }
  console.log(`news: ${NEWS.length}건 삽입`);
} else {
  console.log("news: 데이터가 있어 건너뜀");
}

if (await isEmpty("media")) {
  for (const [i, m] of MEDIA.entries()) {
    await pool.query(
      `INSERT INTO media (cat, title, sub, image, sort_order) VALUES ($1, $2, $3, $4, $5)`,
      [m.cat, m.title, m.sub, m.image, i],
    );
  }
  console.log(`media: ${MEDIA.length}건 삽입`);
} else {
  console.log("media: 데이터가 있어 건너뜀");
}

if (await isEmpty("projects")) {
  for (const [i, p] of PROJECTS.entries()) {
    await pool.query(
      `INSERT INTO projects (badge, title_lines, description, image, links, reverse, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.badge, p.titleLines, p.description, p.image, p.links, p.reverse, i],
    );
  }
  console.log(`projects: ${PROJECTS.length}건 삽입`);
} else {
  console.log("projects: 데이터가 있어 건너뜀");
}

await pool.end();
