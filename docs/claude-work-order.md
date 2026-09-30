# Claude 작업 지시서 — API 연결과 심사 백엔드

> 2026-09-19 인계 갱신: 앞으로의 순서와 담당 범위는 [통합 후속 작업 지시서](claude-fullstack-work-order-2026-09-19.md)를 우선합니다. 아래의 Codex 전용 수정 제한, 심사 구현 대기, checkout 미구현 설명은 과거 기준입니다. Claude가 서버·계약 보완과 검증까지 이어서 담당합니다.

## 0. 이번 요청과 우선순위

앞서 전달한 역할 분담에 따라 실제 작업을 시작해 주세요. **1차는 기존 API와 화면 연결**, **2차는 심사 백엔드의 계약/DB 설계 후 구현**입니다. 디자인을 새로 만드는 작업이 아닙니다. 1차에서 독립적으로 가능한 연결은 확인 질문 없이 진행하고, 계약 차이는 문서에 기록하며 다른 연결을 계속해 주세요.

완성의 기준은 mock에서 그럴듯하게 동작하는 것이 아니라, 실제 API 요청·응답을 처리하고 실패와 미설정 상태를 정확히 표시하는 것입니다. 현재 외부 DB/S3/PG 준비가 안 되어 있으므로 실제 저장·결제 검증 완료를 주장하지 않습니다. 설정이 없더라도 API 어댑터와 오류 UI는 구현·테스트할 수 있습니다.

먼저 읽을 문서:

1. `docs/backend/claude-handoff.md` — 최신 서버 변경의 기준
2. `docs/frontend-handoff.md` — 기존 프런트 상태
3. `docs/backend/frontend-review.md` — 최초 점검 및 후속 대응
4. `docs/submit-flow-contract-proposal.md`, `docs/admin-judge-contract-proposal.md` — 프런트 제안이며 확정 서버 계약과 구분
5. 루트 및 작업 경로의 AGENTS.md, 설치된 Next.js 문서

실제 전송 계약은 `src/contracts/`와 현재 라우트 구현이 기준입니다. 제안서의 가상 경로를 그대로 호출하지 마세요.

## 1. 파일 소유권과 병렬 작업

같은 작업 트리에서 Codex도 작업합니다. 다른 변경을 되돌리지 말고, 작업 시작과 종료 시 현재 파일 상태를 확인하세요.

### Claude가 1차에서 수정할 범위

- `src/lib/api/` — 실제 HTTP 어댑터, mock와 연결 모드 분리
- `src/components/` 및 공개/참가자/관리자 화면 — 기존 디자인 유지, 실제 데이터 연결과 상태 처리
- `src/lib/mock/` — 명시적인 개발 미리보기에서만 유지
- `tests/frontend-api-*.test.mjs` — 어댑터 테스트
- `docs/frontend-handoff.md`, 이번 작업의 증거 문서

### Codex가 유지하는 범위

- `src/server/entries/`, `payments/`, `uploads/`, `notifications/`, `competitions/`, `admin/`
- 기존 `src/app/api/` 라우트, 기존 계약 파일
- `src/lib/auth.ts`, DB/세션/권한 도구, 공통 HTTP 오류 처리
- 배포, 실제 PG/S3/메일/DB 구성과 비활성 플래그

기존 서버와 공통 계약을 화면에 맞추려고 직접 변경하지 마세요. 누락 필드를 `docs/frontend-handoff.md`에 실제 경로/필드/필요 이유로 적어 주세요. Codex가 보완합니다. package.json/lockfile/Next 설정/tsconfig/환경 변수 이름 변경이 필요하면 제안부터 기록하고, 설치된 도구로 가능한 작업을 먼저 진행합니다.

## 2. 1차-A: 공통 HTTP 어댑터와 읽기 화면

### 공통 처리

- 같은 출처 `/api/v1/…`와 실제 Better Auth 세션을 사용합니다. 쿠키/토큰/개인정보를 로그나 브라우저 영구 저장소에 기록하지 않습니다.
- `{data,meta}` 성공 응답과 `{error,meta}` 실패 응답을 각각 Zod로 검증합니다. HTTP 200이라도 계약이 틀리면 오류로 처리합니다.
- 401은 로그인 필요, 403은 권한 없음, 404는 대상 없음으로 구분합니다. 네트워크 실패·비 JSON·5xx·취소·오래된 검색 응답이 최신 결과를 덮는 경우도 처리합니다.
- 실연결 실패 시 mock로 자동 대체하지 않습니다. 데모와 실제 모드는 명시적으로 분리하고 운영 모드에서는 시나리오 버튼을 숨깁니다. 전환 방법은 문서에 남깁니다.
- UI 역할 선택이나 이메일로 권한을 추정하지 않습니다. 서버의 allowedActions와 blockingReasons를 사용합니다.
- 개인/관리자 응답은 캐시하지 않습니다. 로그인 계정 변경·로그아웃 시 이전 데이터를 제거합니다.
- 검색/필터 변경 시 cursor와 일괄 선택 목록을 초기화합니다. 지원하지 않는 필터/정렬은 한 페이지에서만 계산해 전체 결과처럼 표시하지 않습니다.

### 실제 사용 가능한 경로

아래 경로의 계약 파일과 구현 문서를 읽고 연결하세요. 공모 상세는 slug, 관리자 경로는 응답의 competitionId를 사용합니다. `entry_received` 같은 mock ID는 실제 요청에 보내지 않습니다.

| 기능 | 실제 경로 | 계약/주의 |
|---|---|---|
| 공개 공모 목록·상세 | GET `/api/v1/competitions`, `/api/v1/competitions/{slug}` | CompetitionSchema. Apply는 status/readiness/allowedActions에 따라 표시 |
| 본인 운영 권한 | GET `/api/v1/admin/access` | AdminAccessSchema. organizer와 공모별 paymentPermissions 독립, 권한 목록도 페이지 처리 |
| 관리자 공모 목록 | GET `/api/v1/admin/competitions` | competition-admin 계약. 실제 공모 ID 확보 |
| 관리자 접수 목록 | GET `/api/v1/admin/competitions/{competitionId}/entries` | AdminEntriesPageSchema, q/entryStatus/cursor/limit 지원. UUID 오름차순 |
| 본인 접수 목록·상세 | GET `/api/v1/entries`, `/api/v1/entries/{id}` | EntrySummary/EntryDetail. 관리자 목록 계약과 다름 |
| 본인 제출 기록 | GET `/api/v1/entries/{id}/submission` | SubmissionRecordSchema. 당시 participant/work/assets/consents, 현재 결제 상태 아님 |
| 주문 목록·상세 | GET `/api/v1/orders`, `/api/v1/orders/{id}` | 목록은 OrderSummarySchema, 단건은 결제 진행용 PaymentOrderSchema. 서로 다른 계약으로 파싱 |
| 관리자 동의 증적 | GET `/api/v1/admin/competitions/{competitionId}/entries/{id}/consents` | ConsentEvidenceSchema |
| 관리자 보호자 동의 | GET 같은 접수 경로의 `/guardian-consents` | GuardianEvidencePageSchema. 본인 확인 완료로 표시 금지 |
| 결제 예외 목록 | GET `/api/v1/admin/competitions/{competitionId}/payment-reviews` | PaymentReviewSchema. 정상 주문 전체 목록 아님 |
| 관리자 주문 단건 | GET `/api/v1/admin/competitions/{competitionId}/payments/{orderId}` | 목록에서 사라진 주문도 추적 가능 |
| 결제 운영 집계 | GET `/api/v1/admin/competitions/{competitionId}/payment-health` | PaymentHealthSchema. needsReview 등 중복 집계를 합산하지 않음 |

관리자 목록의 workTitle은 영문 우선 표시 제목, category/ageGroup은 ID입니다. 초안 ageGroup은 null입니다. 현재 관리자 mock의 모든 필드(심사 상태/인증서/총건수/이름순 정렬)가 구현됐다고 가정하지 않습니다. q는 200자 이하 문자 검색이며 `%`/`_`는 특수 검색 연산자가 아닙니다.

이번 1차의 우선 완성 흐름: **공모 조회 → Apply 준비 상태 → 본인 목록/제출 상세**, **권한 조회 → 관리자 공모 선택 → 접수 목록/검색**. 이를 완료한 뒤 결제 조회·운영 집계·동의 상세를 연결합니다.

## 3. 1차-B: 저장·업로드·제출 연결

읽기 어댑터가 검증되면 현재 6단계 접수 UI를 유지하면서 다음 흐름을 연결하세요.

1. POST `/api/v1/entries`: CreateEntryRequestSchema와 Idempotency-Key. 서버 응답의 실제 entryId/revision 보관.
2. PATCH `/api/v1/entries/{id}`: UpdateEntryRequestSchema. 저장 성공 응답 이후만 저장됨 표시. revision 충돌은 최신 정보 확인 흐름으로 처리하고 자동 덮어쓰지 않기.
3. 새로고침/재로그인: URL의 entryId로 GET 상세를 조회해 복원. 민감한 입력값을 localStorage에 저장하지 않기. 저장하지 않은 입력 복원까지 보장한다고 안내하지 않기.
4. 업로드: uploads 계약과 `upload-api-implementation.md`, `s3-storage-implementation.md`를 따라 예약 → 서명 PUT → complete → 서버 검증 상태 확인. 서버가 ready로 판정하기 전 성공 처리 금지. 삭제/취소/재시도 시 실제 API의 의미를 따르기.
5. GET `/submission-readiness?locale=en|ko`: 서버 동의문·policyToken·필수 조건 사용. 동의문이 바뀌면 이전 체크 상태로 자동 제출하지 않기.
6. POST `/submit`: SubmitEntryRequestSchema와 동일 시도의 Idempotency-Key. 제출 성공은 submitted이며 received가 아님.
7. 제출 파일 다운로드: POST `/submission/assets/{assetId}/download`, 본문 없음. SubmissionDownloadSchema의 60초 URL 사용. 만료/전송 실패 표시, URL 로그·영구 저장 금지.

변경 요청은 같은 출처에서 보내 브라우저 Origin 검사를 통과해야 합니다. JSON 요청에는 올바른 Content-Type을 사용합니다. 멱등키는 동일 작업의 응답 유실/재시도 동안 유지하고, 다른 본문을 동일 키로 보내지 않습니다.

### 결제 연결 경계

결제 경로 조회와 주문 생성은 기존 payment-options 및 routed-orders 문서를 따라 연결할 수 있습니다. 주문 생성은 실제 결제창 시작이 아닙니다. checkout API는 현재 없으므로 만들었다고 가정하지 마세요. PG SDK·외부 결제창·승인 콜백·웹훅·환불은 Codex 담당입니다.

결제 버튼을 누른 뒤 임의 타이머로 성공 상태를 만들지 않습니다. 실제 호출을 검증하지 못한 구간은 준비 중/미연결로 표시합니다. submitted/received/결제 succeeded를 구분하고 received일 때만 접수번호를 표시합니다. 보호자 이메일 수락은 신원 확인 완료가 아닙니다.

## 4. 2차: 심사 백엔드

### 먼저 만들 산출물

1차 작업 후 `docs/judging-backend-design.md`에 아래 내용을 구체화해 주세요. 문서 작성과 독립 테스트 설계까지 진행하고, 공유 DB/계약 연결 부분은 Codex와 문서로 합의한 뒤 구현합니다. 사용자가 매번 전달하도록 요구할 필요는 없습니다.

- 실제 사용자 ID와 공모/접수별 심사 배정 모델
- 심사 기준·배점 버전, 배정별 초안/제출 상태, revision, 감사 기록
- proposed GET 배정 목록/상세, PATCH 점수·코멘트 초안, POST 최종 제출 경로와 Zod 계약
- 점수 범위·필수 항목·미배정 접근·동시 수정·중복 최종 제출 처리
- 블라인드 PDF가 준비되지 않았을 때의 응답과 차단 방식

### 구현 책임 범위

합의 후 Claude가 `src/server/judging/`, `src/contracts/judging.ts`, `src/app/api/v1/judging/`, `tests/judging-*.test.mjs`를 담당합니다. 디렉터리가 이미 존재하면 먼저 충돌 여부를 확인합니다. 번호 없는 SQL 설계안은 docs 아래에 두고, 실제 migration 번호와 로더 등록은 Codex가 조율합니다. 기존 001~018 migration은 수정하지 않습니다.

### 필수 동작

- Better Auth 실제 세션 + 서버 DB의 활성 배정으로 접근 판정. 본인이 배정되지 않은 작품은 추측 가능한 ID로도 조회·수정 불가.
- 블라인드 전송 타입을 별도로 정의. 이름·이메일·학교·국가·원본 파일명·소유자 ID·원본 스토리지 키를 응답에서 제외. 배정 식별자와 승인된 심사용 정보만 제공.
- 별도 승인된 블라인드 파일이 없으면 PDF 접근 차단. **참가자 원본 다운로드 API를 심사위원에게 재사용하지 않기.** 단순 PDF 메타데이터 삭제로 본문 익명화가 끝났다고 판단하지 않기. 파일 정제·검토 파이프라인은 Codex와 협의.
- 점수는 저장된 심사 기준의 범위로 서버 검증. 실제 배점은 임의 확정하지 말고 테스트 fixture로 구분.
- 저장 실패·revision 충돌 시 기존 값을 보존. 최종 제출 이후 수정은 기본 차단. 재심사/재개 정책은 별도 결정.
- 최종 제출은 멱등적으로 처리하고, 감사 저장 실패 시 상태 변경도 롤백.
- 심사 저장이 publishedResult를 변경하거나 당선 발표·인증서 발급·결제 상태 변경을 유발하지 않기.

결과 발표·인증서·CSV·본선 참가비는 이번 심사 모듈 범위에서 제외하고 후속 계약으로 다룹니다.

## 5. 테스트와 완료 기준

### 1차 필수 검증

- 실제 경로/메서드/요청 헤더·본문과 Zod 응답 파싱을 어댑터 테스트로 확인.
- 401/403/404/409/422/503, 비 JSON, 네트워크 실패, 계약 오류 처리.
- live 실패가 mock 성공으로 바뀌지 않음.
- 공모 준비 미완료 시 Apply 차단. 로그인 계정 변경 시 이전 개인 데이터 제거.
- 관리자 q/상태 변경 시 cursor·선택 초기화, 다음 페이지에 검색 조건 유지, 오래된 응답이 최신 검색을 덮지 않음.
- 저장 실패·업로드 검증 중·동의 정책 변경·결제 대기·접수 확정 지연의 UI 분리.
- 대표 화면을 브라우저에서 EN/KO·모바일/데스크톱 확인. 실제 서버 성공 경로를 실행하지 못했다면 명시.

### 2차 필수 검증

- 본인 배정만 접근, 배정 회수 후 거부, 타 공모/타 심사위원 차단.
- 응답에 참가자 식별정보/원본 파일 키 없음, 블라인드 파일 미준비 차단.
- 점수 범위·필수 항목·revision 충돌·중복 제출·감사 실패 롤백.
- 원장 결제·접수 상태와 공식 결과를 변경하지 않음.

프로젝트 기존 검사 명령을 사용합니다: `node node_modules/typescript/bin/tsc --noEmit --incremental false`, 변경 파일 ESLint, `node --experimental-strip-types --test …`. 프로덕션 빌드는 별도로 검증하고 실패 로그를 남기세요. 타입/모의 테스트 통과를 실 PG·운영 DB 성공으로 표현하지 않습니다.

## 6. 보고 형식

`docs/frontend-handoff.md`에 누적하고 다음 형식으로 짧게 보고해 주세요.

1. 변경 파일과 연결한 실제 API
2. mock로 남은 구간 및 구체적 사유
3. 테스트 명령·결과, 브라우저 확인 범위
4. Codex가 추가해야 하는 정확한 계약/서버 항목
5. 다음 작업에서 수정할 파일 범위

작업 도중 전역 설정/공유 계약 충돌을 발견하면 해당 부분만 보류하고 독립 작업을 계속합니다. 실제 계정 생성·권한 부여·운영 migration·배포·실결제는 이번 지시서의 실행 범위가 아닙니다.
