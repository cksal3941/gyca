# 공개 편집 콘텐츠 CMS 1차

2026-09-19. 정적 샘플로 남아 있던 공지 계열 콘텐츠를 운영자가 작성·수정·발행·보관하고 공개 사이트가 실제 발행 자료만 조회할 수 있는 서버 기반이다.

## 지원 분류

`notice`, `schedule`, `faq`, `news`, `press`를 지원한다. Exhibition·Performance·International·Partner·Winner·Banner·프로젝트 Archive는 승인 상태와 자료 구조가 달라 후속 계약으로 확장한다.

각 문서는 아래 내용을 가진다.

- 고정 `slug`와 분류
- 영문/국문 제목, 요약, 본문
- 화면 표시 날짜
- 선택 표지 이미지: 사이트 내부 `/...` 경로 또는 HTTPS URL과 영문/국문 대체 텍스트

본문은 서식 없는 문자열이다. 프런트는 줄바꿈을 보존한 일반 텍스트로 렌더링하고 HTML로 직접 삽입하지 않는다.

## 관리자 API

- `GET/POST /api/v1/admin/content/editorial`
- `GET/PATCH /api/v1/admin/content/editorial/{contentId}`
- `POST /api/v1/admin/content/editorial/{contentId}/publish`
- `POST /api/v1/admin/content/editorial/{contentId}/archive`

전역 운영자만 접근한다. 쓰기는 동일 Origin, UUID `actionId`, 현재 `expectedRevision`을 요구한다. slug와 category는 생성 후 변경하지 않는다.

| 상태 | 허용 작업 |
| --- | --- |
| `draft` | `edit`, `publish`, `archive` |
| `published` | `edit`, `archive` |
| `archived` | 없음 |

발행된 문서를 고치면 같은 URL에서 새 revision이 공개되고 최초 `publishedAt`은 바뀌지 않는다. 보관 문서는 다시 공개되지 않으며 복원 API는 아직 제공하지 않는다. 같은 actionId와 같은 요청은 같은 응답을 반환하고 내용을 바꾸면 409다.

## 공개 API

- `GET /api/v1/content/editorial?category=&limit=20&cursor=`
- `GET /api/v1/content/editorial/{slug}`

`published` 문서만 반환한다. 목록은 최초 발행시각 내림차순이며 cursor는 category에 묶여 있다. 분류를 바꿀 때 기존 cursor를 재사용하면 422다. 응답에는 관리자 상태·revision·allowedActions·작성자·변경 이력이 없다.

성공 응답은 `public, max-age=60, stale-while-revalidate=300`이다. 보관 직후 기존 CDN/브라우저 캐시에서 최대 60초 보일 수 있으므로 긴급 비공개가 필요한 자료에는 별도 캐시 무효화가 필요하다. 오류 응답은 `no-store`다.

## 저장과 검증

migration 036은 현재 문서, revision별 snapshot, 멱등 action 응답을 저장한다. 상태·내용 변경 전에 정확한 다음 revision의 변경 증거가 있어야 하며, 변경 이력과 action 기록은 UPDATE/DELETE할 수 없다.

PGlite에서 초안 비노출, 생성·수정·발행·발행 후 정정·보관, slug 유일성, revision·멱등성, 공개 최신순 페이지, category cursor 결속, 운영자 권한 회수, HTTP 및 protocol-relative 이미지 차단, 공개 응답의 운영 필드 비노출과 DB 직접 변조 차단을 검증했다. 프런트 정적 `NOTICES` 교체와 운영 PostgreSQL/CDN 캐시 무효화는 아직 연결하지 않았다.
