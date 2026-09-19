# 공모전 등록·수정·공개 API

2026-09-15. 10월 초 접수 오픈을 위한 주최 측 등록 기반이다. 관리자 화면은 Claude 담당이며 이번 변경에는 포함하지 않았다.

## Claude 전달용

- GET `/api/v1/admin/competitions?limit=20&cursor=...`: 비공개 포함 목록. limit 1~50, ID 오름차순.
- POST `/api/v1/admin/competitions`: `{id: 새 UUID, input: CompetitionEdit}`. 성공 201.
- GET `/api/v1/admin/competitions/{competitionId}`: 수정용 상세.
- PATCH 동일 경로: `{revision: 읽은 revision, input: CompetitionEdit}`. 성공 200.

공통 성공 봉투 `{data,meta}`, 오류 봉투는 기존 계약을 따른다. `@/contracts/competition-admin`의 CreateCompetitionSchema, UpdateCompetitionSchema, CompetitionEditSchema를 사용한다.

input은 slug, content, opensAt, closesAt, paymentClosesAt, published를 담는다. content는 EN/KO 제목, EUR 참가비, timezone, keyDates, formSpec, exhibition, guidelines다. 상세 소개 본문·이미지 업로더·자유 폼 빌더는 이번 API에 포함하지 않는다. 기존 공개 공모 API가 소비하는 구조화된 메타데이터 등록 범위다.

상세/쓰기 성공 data는 `{id,revision,draftEnabled,paymentEnabled,input}`. 목록 data는 `{items,nextCursor}`이며 각 항목은 현재 `{id,revision,slug,published,draft_enabled,payment_enabled}`다. 목록에는 내부 결제 정책이나 사용자 정보를 포함하지 않는다.

수정 시 input 전체를 보낸다. slug는 등록 후 변경할 수 없다. 같은 ID 또는 slug로 중복 생성 시 IDEMPOTENCY_CONFLICT 409이며, 요청을 반복해 성공으로 간주하지 않는다. 응답 유실 시 동일 ID를 GET하여 저장 여부를 확인한다. 수정 revision 충돌은 REVISION_CONFLICT 409로, 최신 값을 다시 읽어 편집한다.

공개 토글은 published 변경이다. 공개하면 기존 공개 목록·상세 API에 나타나고 비공개로 변경하면 숨겨진다. **공개와 접수 시작은 별개다.** draft_enabled와 payment_enabled는 신규 등록 시 DB 기본 false이며 클라이언트가 활성 값을 보낼 수 없다. 실제 접수 시작은 후속 운영 준비 검증 단계다.

접수/결제가 활성화되어 있거나 초안이라도 참가자가 생성한 공모전은 전체 수정을 ENTRY_LOCKED 409로 차단한다. 운영 중 긴급 중지나 공지 수정은 별도 좁은 관리 기능이 필요하다. 이 API에는 삭제도 없다.

## 권한·보존

`011_competition_admin.sql`은 revision, gyca_competition_editors, gyca_competition_changes를 추가한다. 실제 DB에는 적용하지 않았다.

gyca_competition_editors에 실제 Better Auth 사용자 ID가 있는 계정만 플랫폼 전체 공모전을 관리한다. 단일 주최 기관을 위한 권한이며 다기관별 격리는 아니다. 권한은 기본 없음이고, 결제 조회 권한이나 demo 관리자 이메일로 대체하지 않는다. 운영자가 확인한 담당자 ID를 별도 DB 관리 절차로 등록해야 한다. 자동 권한 부여 및 권한 관리 화면은 미구현이다.

변경마다 입력 스냅샷·담당자·revision·시각을 같은 트랜잭션에 기록한다. 기록 실패 시 변경을 롤백하며 이력 UPDATE/DELETE는 DB에서 차단한다. 권한 변경 기록과 이력 조회 UI/API는 후속 범위다.

## 검증과 다음 순서

공모 관리·기존 공개 API·정책 테스트 20개 통과. 권한, 공개 전환, 접수 비활성 유지, 중복 등록, 동시 편집 충돌, 잘못된 시간대·마감, 활성/사용 중 공모전 보호, 감사 불변성과 롤백을 확인했다. 전체 TypeScript 및 변경 파일 ESLint 통과. 실제 개발 서버의 비로그인 관리자 목록 GET에서 401을 확인했다.

검증은 PGlite와 비로그인 HTTP 기준이다. 실제 DB·로그인 관리자 화면·실제 결제 연결을 검증한 것은 아니다.

다음은 실제 DB·저장소 연결 상태를 확보하고, 등록 공모전의 제출 정책·3종 동의문·보호자 확인·결제 경로 설정을 준비하여 접수부터 테스트 결제까지 통합하는 작업이다. 실서비스 오픈을 위해서는 공모 등록 화면 연결도 필요하다.
