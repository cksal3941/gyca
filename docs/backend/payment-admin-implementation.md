# 관리자 결제 확인 API

2026-09-15 구현. Claude 담당 디자인·화면·mock·인증 설정은 변경하지 않았다.

## 범위와 권한

Better Auth의 실제 사용자 ID로 `gyca_payment_permissions`를 매 요청 조회한다. 공모전별 `viewer`는 목록·이력 조회, `operator`는 중단된 조회 작업 재개까지 가능하다. 기본 권한은 없다. 화면 역할 선택이나 demo 이메일은 권한 근거가 아니다.

`008_payment_admin.sql`을 마이그레이션 목록에 추가했다. 실제 DB에 적용하거나 관리자 권한을 부여하지 않았다. 운영 담당자가 확인한 사용자 ID와 공모전 ID에만 별도 DB 관리 절차로 권한을 부여해야 한다. 파라미터 바인딩 예시는 다음과 같다.

```sql
INSERT INTO gyca_payment_permissions(user_id,competition_id,permission)
VALUES($1,$2,$3)
ON CONFLICT(user_id,competition_id) DO UPDATE SET permission=EXCLUDED.permission;
```

권한 회수는 해당 행 삭제로 처리한다. 권한 행은 작업 트랜잭션 동안 공유 잠금을 유지한다. 먼저 시작된 처리와 권한 회수는 순서대로 완료되며, 회수 후 신규 요청은 거부된다. 권한 관리 UI/API는 없다. 운영 CLI와 변경 감사는 [결제 권한 절차](payment-access.md)에 추가했으며 신규 운영에서는 직접 SQL보다 이 도구를 사용한다.

## API 계약 — Claude 전달용

### 결제 검토 사유 코드 (2026-09-19 추가)

`PaymentReviewSchema`에 `reviewReasons`를 추가했다. `needsReview=false`이면 빈 배열이고, true이면 최초 `outcome=review` 불변 결제 이벤트의 검증된 증거에서 다음 안전한 코드만 계산한다.

- `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`: 주문의 고정 금액·통화와 다름.
- `PROVIDER_REVIEW_REQUIRED`: 인증된 공급자 조회가 별도 검토를 요구함.
- `PAID_AT_AFTER_VERIFICATION`, `PAID_AT_BEFORE_ORDER`: 승인 시각이 검증 시각 이후이거나 주문 생성 이전임.
- `PAYMENT_EVIDENCE_CONFLICT`: 이미 저장한 결제 식별자·승인 시각과 새 증거가 충돌함.
- `PAYMENT_IDENTITY_REUSED`: 같은 공급자 결제 식별자가 다른 주문에 이미 연결됨.
- `APPROVED_AFTER_DEADLINE`: 정책의 승인 기준 시각이 결제 마감 이상임.
- `ENTRY_STATE_CONFLICT`: 승인 검증 당시 접수 확정 대상 상태가 아님.
- `LEGACY_UNKNOWN`: 검토 플래그는 있으나 원인이 되는 검증 이벤트가 없거나 안전하게 해석할 수 없음.

결제 키·가맹점 ID·공급자 원문·이벤트 ID는 응답하지 않는다. `reviewedAt`은 최초 검토 이벤트의 서버 검증 시각이며 예외 처리의 동시성 토큰으로 사용한다. 코드는 운영자가 원인을 구분하기 위한 진단값이다. 금액/통화/식별자 충돌을 일반 승인으로 처리하는 API는 제공하지 않는다.

### 마감 후 정상 결제의 접수 확정 (2026-09-19 추가)

POST `/api/v1/admin/competitions/{competitionId}/payment-reviews/{orderId}/accept-late-payment`

```json
{
  "actionId": "UUID",
  "reason": "공급자 승인 시각과 접수 건을 확인한 운영 사유",
  "expectedReviewedAt": "PaymentReview.reviewedAt"
}
```

공모별 `operator`만 호출할 수 있다. `allowedActions`에 `accept_late_payment`가 있을 때만 버튼을 표시한다. 서버는 호출 시 다음 조건을 모두 다시 확인한다.

- 주문은 공급자 증거로 이미 `succeeded`이고 `needsReview=true`다.
- 접수는 제출 스냅샷이 있는 `submitted` 상태다.
- 검토 사유가 `APPROVED_AFTER_DEADLINE` 정확히 하나다.
- 검토 이벤트가 하나뿐이며 이후 충돌·취소 등 추가 검토 증거가 없다.
- `expectedReviewedAt`이 최초 검토 이벤트 시각과 일치한다.

성공하면 `needsReview=false`, 접수 `received`, 새 접수번호, 접수 확인 이메일 outbox, `accept_late_payment` 운영 감사 기록을 한 트랜잭션으로 저장한다. 반환값은 `{actionId,outcome:'receipt_issued',entryId,receiptNumber,receivedAt}`다. 같은 actionId와 같은 본문은 동일 결과를 반환하고, 본문이 다르면 409 `IDEMPOTENCY_CONFLICT`다. 상태나 검토 시각이 바뀌면 409 `REVISION_CONFLICT`다.

금액·통화 불일치, 공급자 검토 요구, 승인 시각 이상, 결제 증거/식별자 충돌, 접수 상태 충돌, `LEGACY_UNKNOWN`은 이 API로 처리할 수 없다. 이 경로는 결제를 새로 승인하거나 환불하지 않으며, 이미 공급자에서 승인된 결제의 접수 성립만 운영자가 예외적으로 인정한다. migration 030이 감사 action 제약을 확장하며 감사 기록은 변경·삭제할 수 없다.

### 재확인 진단 필드 (2026-09-16 추가)

목록과 단건 응답의 recovery에 lastErrorCode, nextAttemptAt, leaseExpiresAt을 추가했다. lastErrorCode는 공통 ERROR_CODES 또는 null이며 알 수 없는 DB 문자열은 INTERNAL_ERROR로 치환한다. 공급자의 원본 오류 메시지는 노출하지 않는다. null은 오류가 기록되지 않았다는 뜻이며 결제 성공을 뜻하지 않는다.

nextAttemptAt은 pending 상태의 다음 실행 가능 시각이며 다른 상태에서는 null이다. 스케줄러 실행 지연으로 실제 조회는 늦어질 수 있다. leaseExpiresAt은 running 작업의 점유 만료 시각이며 다른 상태에서는 null이다. 결제 마감이나 참가자의 결제 유예 시각이 아니며, 이 시각이 지나도 버튼을 클라이언트에서 활성화하지 않는다. allowedActions를 따른다. 완료/중단 상태에 오래된 due_at을 표시하지 않는다.

재개 시 오류 초기화, 상태별 시각 노출, 미등록 오류 비노출과 기존 복구 동작을 포함해 관련 테스트 24개 및 타입·ESLint 검사 통과. 정책/DB 구조/재시도 동작은 변경하지 않았다.

### 단건 상태 추적 (2026-09-16 추가)

GET `/api/v1/admin/competitions/{competitionId}/payments/{orderId}`는 해당 공모의 주문을 `PaymentReviewSchema`로 반환한다. 예외 목록과 달리 정상/대기 주문도 조회하며, 재확인 작업 재개 후 목록에서 사라진 주문의 추적에 사용한다. 기존 `{data,meta}` 응답이다. 복구 작업이 없으면 recovery=null이다.

viewer/operator 모두 조회 가능하며 매 요청 실제 공모별 권한을 확인한다. 비로그인 401, 권한 없음/회수 403, 권한 있는 공모에서 다른 공모의 주문 또는 없는 주문을 요청하면 404, 잘못된 UUID는 422다. private,no-store이며 결제 키·가맹점 ID·참가자 개인정보를 반환하지 않는다. DB 상태 조회이므로 이 GET 자체가 PG 재조회를 실행하거나 접수 상태를 바꾸지는 않는다. allowedActions는 목록과 같은 서버 판정이다.

재개 후 단건 추적, 복구 작업 없는 주문, 공모 범위·권한 회수·비공개 정보 비노출을 포함한 결제 관리자 테스트 11개, 전체 타입 검사와 변경 파일 ESLint 통과. 실제 PG·운영 DB 연결 테스트는 아니다.

기본 경로: `/api/v1/admin/competitions/{competitionId}/payment-reviews`

| 요청 | 결과 |
| --- | --- |
| `GET ?limit=20&cursor={uuid}` | `needsReview=true` 또는 복구 큐 `stalled` 주문 목록 |
| `GET /{orderId}/history?limit=20&cursor={uuid}` | 담당자 ID·사유·작업 시각·작업 종류 이력 |
| `POST /{orderId}/requeue` | 중단된 PG 조회 작업을 다시 큐에 등록 |
| `POST /{orderId}/accept-late-payment` | `APPROVED_AFTER_DEADLINE` 단일 사유의 검증된 성공 결제를 접수 확정 |

성공은 기존 `{data,meta}` 봉투, 목록은 `{items,nextCursor}`. 페이지 크기 1~50, 기본 20. UUID 오름차순 커서이며 시간순 정렬이 아니다. 화면 목록은 변화 중인 작업 목록이므로 스냅샷을 보장하지 않는다. 이력은 목록에서 사라진 주문도 별도로 조회할 수 있다.

`@/contracts/payment-admin`의 `PaymentReviewSchema`, `PaymentAdminActionSchema`, `RequeueRecoveryRequestSchema` 사용. 기존 `apiSuccessSchema`와 `pageSchema`로 HTTP 응답을 파싱한다. 검토 사유 표시는 `reviewReasons` 코드의 EN/KO 카피로 매핑한다.

목록의 `allowedActions`에 `requeue_recovery`가 있을 때만 재조회 버튼을 활성화한다. 금액은 `money.amountMinor`와 EUR. 참가자 이름·연락처·카드정보·paymentKey·가맹점 ID·원본 PG 응답은 반환하지 않는다. 이력 사유는 텍스트로 렌더링하고 카드·연락처 등 개인정보를 입력하지 않도록 안내한다.

POST 본문:

```json
{
  "actionId": "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx",
  "reason": "PG 조회 장애 복구 확인 후 재조회 요청",
  "expectedUpdatedAt": "목록의 recovery.updatedAt 값을 그대로 전달"
}
```

예시 actionId는 자리표시자이며 실제 요청은 새 UUID가 필요하다. 같은 작업의 네트워크 재시도에는 UUID와 본문을 그대로 재사용한다. 사유는 공백 제거 후 1~1000자. 성공 데이터는 `{actionId,outcome:"recovery_queued"}`로, 과거 작업 접수 확인이며 현재 큐 상태나 결제 성공을 뜻하지 않는다. 응답 후 목록을 다시 조회한다.

같은 actionId에 다른 본문은 `IDEMPOTENCY_CONFLICT` 409, 최신 상태와 달라졌거나 재개 불가능하면 `REVISION_CONFLICT` 409. 로그인 없음 401, 권한 없음 403, 허용 공모전 밖 주문은 404. POST에는 정상 세션·동일 Origin·JSON이 필요하다. 응답은 `private, no-store`.

## 처리 보장과 제한

- `stalled`이며 결제 성공/검토 필요 상태가 아닌 주문만 재개한다. PG 중복 승인, 금액 불일치 등 `needsReview`를 해제하지 않는다.
- 재개는 attempts를 0으로 돌리고 pending으로 등록한다. PG 승인 요청·환불·수동 접수 확정을 수행하지 않는다.
- 큐 변경과 담당자·사유 감사 기록을 한 트랜잭션으로 저장한다. 감사 기록 실패는 큐 변경도 롤백한다. 감사 행 UPDATE/DELETE는 DB 트리거로 차단한다.
- 기존 내부 복구 워커가 이후 조회한다. 워커/PG 설정이 꺼져 있으면 큐 등록만 되고 실제 조회는 진행되지 않는다. 실제 스케줄러 연결은 남아 있다.
- DB 권한 부여, 운영 DB 마이그레이션, 실PG 테스트, 관리자 화면 연결은 미실행이다. 예외 결제의 환불·판정·종결 절차도 후속 범위다.

## 검증

2026-09-19 전체 서버 테스트 249개, TypeScript 검사와 서버 ESLint 통과. 결제 관리자 집중 테스트는 검토 사유 분류, 첫 검증 경계 우선, 이전 데이터의 `LEGACY_UNKNOWN`, 마감 후 승인 단일 사유만의 접수 확정, 후속 검토 이벤트 발생 시 액션 제거, 멱등 재전송, 잘못된 사유·오래된 상태·viewer 차단, 감사 실패 시 접수번호·검토 플래그·메일 작업 전체 롤백, HTTP 입력과 Origin을 검증한다.

PGlite 격리 DB를 사용했으며 실제 PostgreSQL 다중 연결 경합 검증은 아니다. 개발 서버의 실제 GET 경로에서 비로그인 401 및 `private, no-store`를 확인했다. 실제 로그인 관리자 화면 QA는 수행하지 않았다.
