# 공개 공모 API 구현

## 제공 경로

- GET `/api/v1/competitions`: 공개 공모 목록. status 선택, limit 기본 20·최대 50, cursor 페이지 처리.
- GET `/api/v1/competitions/{slug}`: 공개 공모 상세.

공통 ApiSuccess<Competition> 또는 ApiSuccess<Page<Competition>> 응답이다. 로그인은 필요하지 않다. 미공개 공모 또는 public_content가 없는 공모는 목록에서 제외하고 상세는 404다. 공개 응답에는 저장소의 내부 제어 필드를 포함하지 않는다.

클로드의 src/lib/api/index.ts는 아직 mock 어댑터다. 이번 작업은 그 파일이나 화면·스타일을 수정하지 않았다. 실제 API 연결은 데이터 등록 및 DB 환경 검증 이후 별도 HTTP 어댑터에서 처리한다. 홈 디자인 복구와 독립적인 변경이다.

## 정책의 공통 기준

src/server/competitions/policy.ts가 DB 설정을 공개 Competition으로 변환한다. 접수 초안 생성·수정도 동일한 projectCompetition/draftPolicyError 판정을 사용한다.

- 상태는 서버 시각과 phase로 계산한다. archived/judging/result는 명시적 운영 단계이며 scheduled는 날짜로 upcoming/open/closed를 구분한다.
- readiness는 설정 준비 여부다. open이고 application readiness가 true일 때만 start_entry를 반환한다.
- application에는 draft_enabled, 접수 시작·종료, 폼 및 나이 기준일, 필수 여부, 업로드 용량 설정이 필요하다.
- payment readiness에는 payment_enabled, 요금, 결제 종료 설정이 필요하다. 이는 아직 결제 API나 PG 연결 완료를 뜻하지 않는다. 기본값은 false다.
- 승인 전 전시의 venueName과 logoUrl은 서버에서 null로 제거한다. displayName은 공개용 예정 문구만 등록해야 한다.
- 공개 요강이 없으면 view_guidelines 액션이 없다.
- 응답은 no-store이며 클라이언트도 stale 데이터를 근거로 접수 권한을 확정해서는 안 된다. 쓰기 API가 매 요청 재검증한다.

목록의 status 필터 SQL과 상세의 상태 계산은 모든 상태에 대한 테스트로 일치 여부를 검사한다. 둘 중 하나를 변경하면 함께 수정해야 한다.

## DB 변경

002_competitions.sql은 기존 gyca_competitions에 phase, public_content, payment_enabled, payment_closes_at를 추가한다. 001_entries.sql은 변경하지 않았다. 기존 설치는 기존 체크섬을 유지하면서 002만 적용한다.

```sh
node --env-file=.env.local scripts/migrate-entries.mjs
```

위 명령은 001과 002의 체크섬을 순서대로 확인하고 아직 적용되지 않은 파일을 하나의 트랜잭션에서 실행한다. 인증 테이블이 먼저 필요하다. 실제 DB에는 아직 적용하지 않았다.

public_content는 title, fee, timezone, keyDates, formSpec, exhibition, guidelines를 담는 구조화된 공개 콘텐츠다. id/slug/phase/기간/공개 여부/활성 플래그는 DB 컬럼이 기준이다. JSON에 넣은 status/readiness/allowedActions 값은 권위 있는 설정으로 사용하지 않는다.

실제 공모 데이터·미확정 마감·전시 승인·용량·보호자 정책을 임의로 등록하지 않았다. 저장소와 CMS 관리 UI도 이번 범위가 아니다. draft_enabled를 켜는 운영 경로에서 필수 운영 정책의 승인 여부를 확인해야 한다.

src/server/database.ts로 접수·공모의 연결 풀을 공유한다. DATABASE_URL이 없으면 기본 로컬 DB를 추측해 연결하지 않고 POLICY_NOT_CONFIGURED(503)를 반환한다. 오류에 연결정보를 노출하지 않는다.

## 검증

- 전체 계약·공모 정책·PGlite 기반 접수/공모 HTTP 핸들러 테스트: 부모 테스트 포함 40개 통과.
- 공개/미공개 분리, 상태 필터, 커서 페이지, 마감 경계, 공모 액션과 실제 초안 차단의 일치 확인.
- 타입 검사와 서버 변경 파일 lint 통과.
- 실행 중인 Next.js의 실제 GET /api/v1/competitions에서 DB 미설정 503 응답 확인.
- 실제 네트워크 PostgreSQL·로그인 세션 기반 쓰기 E2E 및 배포는 수행하지 않았다.

```sh
node --experimental-strip-types --test tests/contracts.test.mjs tests/entries-api.test.mjs tests/competition-policy.test.mjs tests/competitions-api.test.mjs
```

## 다음 작업

개발용 DB가 제공되면 마이그레이션·실제 로그인 저장 검증부터 수행한다. 독립적인 다음 구현은 업로드 세션·비공개 파일 참조·업로드 완료 검증 계약이다. 스토리지 공급자·maxBytes 미확정 상태에서는 실제 업로드 경로를 임의로 열지 않는다.
