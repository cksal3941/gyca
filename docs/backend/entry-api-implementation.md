# 접수 임시저장 API 구현 현황

## 구현 범위

- POST `/api/v1/entries`: 초안 생성. `Idempotency-Key` 필수.
- GET `/api/v1/entries`: 본인 초안 목록. cursor 기반, 기본 20건·최대 50건.
- GET `/api/v1/entries/{id}`: 본인 초안 상세.
- PATCH `/api/v1/entries/{id}`: revision 기반 부분 저장.

이번 단계는 초안 저장만 제공한다. 제출·파일·결제·심사·결과는 아직 미구현이다. DB 상태가 draft가 아니면 이 단계의 상세 조회·수정은 ENTRY_LOCKED를 반환한다. 이후 제출 구현에서 상세 읽기 모델을 확장해야 한다. 현재 데이터에 임의로 received를 설정하면 안 된다.

## 요청과 응답

동일 출처 Better Auth 세션 쿠키를 사용한다. 사용자 ID를 JSON 또는 테스트용 헤더로 받지 않는다. 실행 코드에서는 Better Auth 서버 API가 사용자 ID를 제공하며, 테스트의 x-test-user는 주입된 테스트 인증 함수에서만 사용한다.

POST 입력:

```json
{"competitionId":"competition_identifier"}
```

PATCH 입력:

```json
{"revision":1,"participant":{"name":"참가자"},"work":{"englishTitle":"My Book"}}
```

participant/work/guardian의 전달한 필드만 병합한다. 누락 필드는 유지하고 빈 문자열은 텍스트 삭제로 취급한다. 날짜·출판 여부의 null은 미입력 상태다. 저장된 필드들을 통째로 교체하지 않는다. owner/status/price 등 미허용 필드는 422다. 성공할 때마다 revision이 증가하며 화면은 반환한 revision을 다음 저장에 사용한다.

응답은 공통 `ApiSuccess<EntryDetail>` / `ApiSuccess<Page<EntryDetail>>`다. EntryDetailSchema, CreateEntryRequestSchema, GuardianDraftSchema를 src/contracts에 추가했다. 목록은 현재 상세 초안 자료를 포함하므로 개인 캐시를 금지한다. 추후 목록용 최소 DTO를 따로 제공할 수 있다.

EntrySummary와 EntryDetail은 마이페이지 표시용 `competitionTitle`, `workTitle`, `categoryLabel`을 공통으로 제공한다. 제출 기록이 있으면 제출 당시 snapshot의 공모 content와 작품을 사용하며, 공모명·부문 라벨을 나중에 수정해도 기존 접수 표시가 바뀌지 않는다. 초안 또는 snapshot 없는 legacy 자료만 현재 공모 content와 entry work로 보완한다. category가 없거나 formSpec에서 일치하는 부문을 찾지 못하면 categoryLabel은 null이다.

서버가 반환하는 행동은 현재 edit뿐이다. 구현하지 않은 upload/submit/start_payment 액션은 반환하지 않는다. POLICY_NOT_CONFIGURED는 아직 보호자·제출 정책이 준비되지 않았다는 의미로 편집 가능 응답에도 포함될 수 있다.

타인의 ID와 존재하지 않는 ID는 모두 404다. 소유자를 확인하기 전에 상태·revision·자료를 노출하지 않는다. 오류 응답이나 로그에 지원서 원문·SQL·DB 접속정보를 남기지 않는다.

## 중복 및 충돌

- 생성 키는 계정 범위에서 고유하며 현재 단계에서는 만료하지 않는다.
- 같은 키와 같은 공모는 같은 entry ID와 현재 초안 표현을 반환한다. 최초 응답 바이트를 저장해 재생하는 방식은 아니다. 재시도 후 수정된 내용은 최신 내용으로 보인다.
- 같은 키와 다른 공모는 IDEMPOTENCY_CONFLICT다.
- 생성 키 잠금 및 생성·키 저장은 DB 트랜잭션 안에서 수행한다.
- 수정은 owner 조건과 행 잠금으로 revision을 검사한다. 같은 revision으로 두 요청이 오면 하나만 성공한다.
- 경쟁 공모의 설정도 트랜잭션 동안 공유 잠금으로 보호한다.
- 마감은 서버 시각으로 now >= closes_at일 때 거부한다. 마감값 자체는 아직 운영 확정 전이며 자동으로 채우지 않는다.

## DB 설치

추가 변경: 002_competitions.sql 및 공개 콘텐츠를 함께 사용한다. 초안 허용 판정은 공개 Competition API와 동일한 정책 모듈로 통합했다. 공모의 기본 기간 플래그만 설정해서 초안을 개방할 수 없으며 유효한 public_content와 폼 정책도 필요하다. 상세는 competition-api-implementation.md를 따른다.

환경변수는 로컬 .env.local 등으로 제공한다. 연결 문자열을 문서나 소스에 저장하지 않는다.

```sh
node --env-file=.env.local scripts/migrate.mjs
node --env-file=.env.local scripts/migrate-entries.mjs
```

첫 명령은 기존 인증 테이블, 둘째는 신규 접수 테이블을 만든다. 둘째 스크립트는 단일 트랜잭션, 마이그레이션 잠금, 체크섬을 사용한다. 실패 시 롤백한다. 공모·실제 사용자·접수 자료는 자동 생성하지 않는다. 이번 작업에서는 실제 DB에 실행하지 않았다.

gyca_competitions는 공개 CMS가 아니라 서버 내부의 최소 접수 게이트 테이블이다. published와 draft_enabled는 false, opens_at/closes_at는 null로 시작한다. 운영 정책이 확정되지 않은 공모를 자동 개방하지 않는다. 테스트에만 가상 기간·공모를 사용한다.

계정 참조는 ON DELETE RESTRICT다. 출품 자료가 있는 계정의 기존 Better Auth 삭제는 정책 확정 전 DB에서 차단된다. 데이터 삭제·익명화·결제 보관 정책과 계정 삭제 UX를 출시 전에 구현해야 한다. 이번에는 인증 설정이나 화면을 변경하지 않았다.

PATCH/POST에는 application/json 및 BETTER_AUTH_URL과 동일한 Origin이 필요하다. BETTER_AUTH_URL 미설정 시 쓰기는 POLICY_NOT_CONFIGURED(503)로 차단된다. 본문은 Content-Length를 신뢰하지 않고 스트림 기준 128 KiB로 제한한다.

## 검증 결과와 범위

- 계약 검증 13개와 PostgreSQL 엔진 기반 핸들러 하위 시나리오 14개 통과(테스트 러너 합계는 부모 테스트 포함 28).
- 저장 지속성, 필드 병합, 타인 접근, 중복 생성, revision 충돌, 페이지 처리, 입력 크기, 미확정 정책, 마감 정각, 잠긴 초안을 검사했다.
- 전체 TypeScript 검사 및 변경 파일 lint 통과.
- 실행 중인 Next.js의 GET /api/v1/entries에서 실제 HTTP 401과 private, no-store를 확인했다.
- 테스트 엔진은 메모리 기반 PGlite다. DB 응답을 mock한 테스트는 아니지만, 네트워크 PostgreSQL 풀과 다중 연결 경쟁을 검증한 것은 아니다.
- 로그인된 Better Auth 세션 → 실제 네트워크 PostgreSQL → HTTP 저장/재조회 전체 검증은 개발용 DB 연결 후 필요하다. 실결제 검증은 이번 범위가 아니다.

```sh
node --experimental-strip-types --test tests/contracts.test.mjs tests/entries-api.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/server/entries src/app/api/v1/entries src/contracts/index.ts tests/entries-api.test.mjs scripts/migrate-entries.mjs
```

## 변경 경계

화면·스타일·클로드 fixture는 변경하지 않았다. package.json/lockfile에는 테스트 전용 PGlite를 추가했다. tsconfig에는 Node의 TS 테스트 실행과 Next의 noEmit 검사를 함께 지원하도록 allowImportingTsExtensions를 추가했다. 기존 Next·인증·배포 구조는 유지한다.

## 후속 작업

1. 개발용 DB 환경에서 마이그레이션, 로그인된 HTTP 저장, 다중 연결 경쟁 검증.
2. 공개 Competition API와 내부 접수 게이트의 공통 정책 연결.
3. 업로드 저장소·용량 정책 확정과 직접 업로드·파일 검증.
4. 동의 확인·제출 스냅샷 및 결제 주문 처리.
5. 실접수 공개 전 생성·저장 요청의 사용자별 사용량 제한과 데이터 삭제 정책 보완.
