# GYCA 공통 전송 계약

`index.ts`에서 타입과 Zod 스키마를 제공한다. 서버 코드나 환경변수를 import하지 않아 프런트 어댑터에서 사용할 수 있다. 타입 선언만 필요한 컴포넌트는 `import type`을 사용한다.

```ts
import { CompetitionSchema, apiSuccessSchema } from "@/contracts";
import type { Competition } from "@/contracts";

const fixture: unknown = {};
const result = CompetitionSchema.safeParse(fixture);
const responseSchema = apiSuccessSchema(CompetitionSchema);
```

raw fixture 또는 HTTP 응답은 어댑터 경계에서 parse/safeParse한다. 파싱한 값에서 branded ID 및 시각 타입을 얻는다. 문자열을 타입 단언으로 강제 변환하지 않는다. HTTP 성공 응답 전체에는 apiSuccessSchema, 목록에는 pageSchema를 조합한다. 실패 응답에는 ApiFailureSchema를 사용한다. 파싱 실패는 정상 API 데이터로 전달하지 않는다.

## 제공 범위

관리자 결제 계약은 `@/contracts/payment-admin`에서 제공한다. PaymentReviewSchema의 `reviewReasons`·`reviewedAt`, PaymentAdminActionSchema, RequeueRecoveryRequestSchema, AcceptLatePaymentRequestSchema를 사용하며 상세 경로·권한은 docs/backend/payment-admin-implementation.md를 따른다.

업로드 계약은 `@/contracts/uploads`에서 별도로 제공한다. UploadRequest/UploadSession과 생성·삭제 입력 스키마를 포함한다. ERROR_CODES에는 STORAGE_UNAVAILABLE, UPLOAD_EXPIRED, UPLOAD_LIMIT_REACHED가 추가됐다. 실제 저장소 연결 상태는 docs/backend/upload-api-implementation.md를 따른다.

- Competition, FormSpec, LocalizedText, Money
- EntrySummary, UpdateEntryRequest, Asset
- OrderSummary, CertificateSummary
- GuardianVerificationSchema, FinalParticipationSchema
- API 성공·실패·목록 스키마 및 상태·액션·코드 상수

초안 저장용 EntryDetailSchema, CreateEntryRequestSchema, GuardianDraftSchema를 추가했다. 초안 API에는 본인 접근·저장 검증을 구현했다. 동의 문서 응답, 업로드 서명, checkout 및 제출 요청은 후속 구현에서 추가한다. 스키마 검증은 승인 조회나 권한 검사를 대신하지 않는다. 실제 DB 연결 검증 현황은 docs/backend/entry-api-implementation.md를 따른다.

## Claude fixture 매핑

1. 공모마다 `id` 추가. `slug`는 URL용으로 별도 유지한다. Entry의 competitionId는 해당 id와 맞춘다.
2. 모든 공모에 `blockingReasons`를 둔다. 이유가 없으면 빈 배열이다.
3. `work.titleEn` → `work.englishTitle`, `work.descriptionEn` → `work.englishDescription`. 폼 path도 동일하게 바꾼다.
4. guidelines가 null이면 view_guidelines 액션을 제거한다.
5. open-ready 시나리오는 개발용으로 확정한 테스트 정책을 모두 제공해야 한다. formSpec/나이 기준일/필수 여부/maxBytes/접수 시작·종료가 null이면 application readiness는 false다. payment readiness에는 fee와 결제 종료가 필요하다. 이 값들은 실서비스 정책으로 재사용하지 않는다.
6. keyDates 마감 정확 시각이 미정이면 value=null로 둔다. 공고의 23:59 문구와 배타적 종료 시각을 혼동하지 않는다.
7. orders/certificates의 competitionTitle은 `{en,ko}` 형태다.
8. fixture의 일부 상태 필드만 있는 객체는 EntrySummarySchema에 바로 전달하지 않고 공통 기본값과 합친다.
9. EntrySummary의 competitionTitle/workTitle/categoryLabel은 목록 표시용 서버 값이다. 제출 후에는 제출 snapshot에서 읽어 현재 공개 공모 데이터와 다시 조인하지 않는다.

HOME의 실제 Apply 액션은 파싱된 공모 allowedActions에 start_entry가 있을 때만 제공한다. status/readiness는 안내에 활용하되 새로운 허용 액션을 클라이언트에서 산정하지 않는다. 스키마는 모순된 공모 액션을 거부한다. 현재 페이지·fixture는 Claude 담당이며 이 변경에서 수정하지 않았다.

미확정 정책은 그대로 null/false를 유지한다. 이름의 필수 여부, 실제 저장 용량, 보호자 방식, 나이 기준일, 전시 승인을 이번 코드가 확정하지 않는다. 초안 텍스트의 20,000자 상한은 요청 크기를 제한하는 기술 상한이며 공모별 최종 제출 글자 수 규칙이 아니다.

## 검사

Node 24 환경에서:

```sh
node --experimental-strip-types --test tests/contracts.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/contracts/index.ts tests/contracts.test.mjs
```

Node 기본 테스트 러너를 사용해 별도 테스트 의존성을 추가하지 않았다. 테스트는 전송 계약 검증이며 실결제·DB 통합 테스트가 아니다.
# 제출 단계 추가

토스 인증 반환 처리는 `payments.ts`의 `ConfirmPaymentRequestSchema`를 사용한다. body는 paymentKey만 받으며, 구현 범위는 [토스 어댑터 안내](../../docs/backend/toss-adapter-implementation.md)를 따른다.

결제 원장의 신규 타입은 `payments.ts`의 `PaymentOrderSchema`다. 본인 주문 목록·재확인·운영 확인 상태 매핑은 [결제 API 구현 현황](../../docs/backend/payment-api-implementation.md)을 따른다. 실제 PG 어댑터는 아직 비활성이다.

`submissions.ts`는 제출 준비 상태, 동의 문서 세 종류, 제출 요청·성공 응답을 정의한다. 화면 연결 순서와 재시도 규칙은 [제출 API 구현 현황](../../docs/backend/submission-api-implementation.md)을 따른다. `submitted` 응답은 접수 확정이 아니다.
