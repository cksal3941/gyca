# 파트너 CMS와 관계 확인 게이트

2026-09-19. 해외 기관·전시장·출판사 등을 공식 파트너로 표시하기 전에 관계 확인 증거를 남기고, 관계가 철회되면 공개 목록과 상세에서 즉시 제외하는 서버 기능이다.

## 지원 유형과 상태

지원 유형은 `organizer`, `international_program_partner`, `venue`, `cultural_partner`, `publishing_partner`, `educational_partner`다. 각 항목에는 영문/국문 이름·설명, 표시 순서, 선택 HTTPS 웹사이트와 로고가 있다.

콘텐츠 상태와 관계 상태는 분리한다.

| 관계 상태 | 콘텐츠 상태 | 공개 가능 | 관리자 작업 |
| --- | --- | --- | --- |
| `pending` | `draft` | 아니요 | 수정, 관계 확인, 보관 |
| `confirmed` | `draft` | 아니요 | 수정, 발행, 보관, 관계 철회 |
| `confirmed` | `published` | 예 | 수정, 보관, 관계 철회 |
| `revoked` | `archived` | 아니요 | 없음 |

`pending` 파트너는 발행할 수 없다. 관계 확인은 내부 계약서·이메일 승인 기록 같은 `evidenceReference`와 확인 사유를 요구한다. 관계 철회는 파트너를 같은 트랜잭션에서 `archived`로 바꾸며 되돌리기 API는 제공하지 않는다.

## API

공개:

- `GET /api/v1/content/partners?partnerType=&limit=20&cursor=`
- `GET /api/v1/content/partners/{slug}`

관리자:

- `GET/POST /api/v1/admin/content/partners`
- `GET/PATCH /api/v1/admin/content/partners/{partnerId}`
- `POST /api/v1/admin/content/partners/{partnerId}/confirm`
- `POST /api/v1/admin/content/partners/{partnerId}/publish`
- `POST /api/v1/admin/content/partners/{partnerId}/archive`
- `POST /api/v1/admin/content/partners/{partnerId}/revoke`

관리자 쓰기는 전역 운영자 권한, 동일 Origin, UUID `actionId`, 현재 `expectedRevision`을 요구한다. 확인·철회 본문에는 `evidenceReference`와 `reason`이 추가된다. 버튼은 `PartnerAdminItem.allowedActions`로만 표시한다.

공개 목록은 `displayOrder`, ID 순서이며 cursor는 partnerType 필터에 묶인다. 공개 응답에는 관계 상태, 증거 참조, 사유, revision, 관리자 작업이 없다. 관계 철회를 캐시가 지연시키지 않도록 성공과 오류 모두 `Cache-Control: no-store`다.

## 저장과 검증

migration 037은 현재 파트너, revision별 snapshot, 관계 확인·철회 증거, 멱등 action 응답을 저장한다. projection 변경은 정확한 다음 revision 이력과 관계 증거가 있어야 한다. 변경·관계·action 이력은 UPDATE/DELETE할 수 없다.

PGlite에서 미확인 파트너 비노출, 확인 전 발행 차단, 확인 증거 필수, 발행·수정·정렬·필터 cursor, 공개 응답의 내부 정보 비노출, 철회와 즉시 비공개, 권한 회수, 안전한 URL, 멱등성과 DB 직접 변조 차단을 검증했다. 운영자가 사용할 파트너 관리 화면과 실제 계약 문서 저장소 연결은 후속 작업이다.
