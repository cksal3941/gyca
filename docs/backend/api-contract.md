# 프런트엔드 API 계약 초안 v0.1

상태: 전체 계약 초안. 접수 초안 생성·목록·조회·PATCH는 [임시저장 구현 현황](entry-api-implementation.md)에 따라 구현했다. 나머지 엔드포인트는 아직 미구현이다.

추가 구현: 공모 GET 목록·상세는 [공개 공모 API 구현](competition-api-implementation.md)을 따른다. 데이터 등록 및 실제 DB 연결 검증은 아직 남아 있다.

갱신: Claude 검토에 대한 추가 필드·목록 API·공통 코드·담당 범위는 [v0.2 결정](frontend-resolution.md)을 따른다. 이 문서와 충돌하면 v0.2가 우선한다.

## 공통 규칙

- 접두사 제안: `/api/v1`. 기존 `/api/auth/*`는 유지한다.
- 동일 출처 Better Auth 세션 사용. 서버에서 인증·소유권·역할·배정을 확인한다.
- 변경 요청의 Origin 및 CSRF 방어를 검토·적용한다. 세션이 있다는 이유만으로 쓰기를 허용하지 않는다.
- 개인 응답에는 `Cache-Control: private, no-store`를 적용한다.
- ID는 opaque string, 시각은 UTC ISO 8601, 날짜는 `YYYY-MM-DD`, 금액은 통화 최소 단위 정수다.
- 페이지 목록은 `items`, `nextCursor`를 사용하며 최대 페이지 크기를 제한한다.
- 서버 시각은 `meta.serverTime`, 추적 ID는 `meta.requestId`로 반환한다.
- 오류 응답에는 비밀 값·SQL·지원서 원문을 포함하지 않는다.

성공 예:

```json
{"data":{"id":"entry_example","revision":1},"meta":{"requestId":"request_example","serverTime":"2026-09-15T00:00:00Z"}}
```

오류 예:

```json
{"error":{"code":"REVISION_CONFLICT","message":"The entry has changed.","fieldErrors":[],"retryable":false},"meta":{"requestId":"request_example","serverTime":"2026-09-15T00:00:00Z"}}
```

`fieldErrors`는 `{path, code}` 배열이다. 화면 번역은 `code`를 기준으로 한다. 알 수 없는 오류 코드는 공통 오류로 표시한다. `retryable`은 같은 요청을 무조건 자동 재전송하라는 의미가 아니다.

## 엔드포인트

| 메서드 / 경로 | 입력 요약 | 결과 및 조건 |
| --- | --- | --- |
| GET `/competitions/{slug}` | slug | 공개 공모 정보·비용·폼 규격·정책 준비 상태 |
| POST `/entries` | competitionId | 로그인 소유자의 초안 생성 |
| GET `/entries` | cursor, limit | 본인 접수 목록 |
| GET `/entries/{id}` | entry ID | 본인 지원서, 상태, revision, 가능한 행동 |
| PATCH `/entries/{id}` | revision, participant, work | 허용된 초안 필드만 저장. 상태·가격·소유자는 변경 불가 |
| POST `/entries/{id}/uploads` | purpose, filename, sizeBytes, mediaType | 파일 ID 및 제한·만료가 있는 전송 정보 |
| POST `/entries/{id}/uploads/{assetId}/complete` | 업로드 완료 참조 | 서버 저장소 확인 및 검증 접수. 이 응답만으로 파일 ready 아님 |
| DELETE `/entries/{id}/uploads/{assetId}` | revision | 초안에서 참조 해제. 고정된 제출 파일은 제거 불가 |
| POST `/entries/{id}/submit` | revision, consentConfirmations | 스냅샷 생성 및 submitted 전환 |
| POST `/entries/{id}/checkout` | returnPath | 서버 가격으로 주문 생성 또는 유효 주문 재사용 |
| POST `/orders/{id}/reconcile` | order ID | 공급자 상태 재확인 요청. 제한된 횟수로 허용 |
| GET `/orders/{id}` | order ID | 본인 주문, 결제 상태, 접수 확정 상태 |
| GET `/entries/{id}/certificates` | entry ID | 공개 및 발급된 본인 인증서 목록 |
| POST `/certificates/{id}/download` | certificate ID | 권한 확인 후 만료되는 다운로드 URL |

`returnPath`는 허용된 내부 경로만 받는다. 임의 외부 리다이렉트 URL을 허용하지 않는다. PG별 브라우저 콜백·웹훅 경로는 공급자 선정 후 추가한다. 결제 정보는 콜백 파라미터를 신뢰하지 않고 공급자 API/서명을 검증한다.

POST의 중복 생성 가능 작업에는 `Idempotency-Key`를 요구한다. 계정·행위·대상에 범위를 묶고 같은 키와 같은 payload는 원래 결과를 반환한다. 같은 키에 다른 payload는 409다. 키 보관 기한과 처리 중 응답은 구현 시 명시한다. DB 고유 제약도 함께 사용한다.

## 참가자 초안 필드 제안

| 그룹 | 필드 | 비고 |
| --- | --- | --- |
| participant | name, dateOfBirth, residenceCountry, nationality, school | 필수 여부 및 공개 범위는 별도 결정 |
| guardian | name, email | 보호자 요구 정책 및 실제 확인 방식과 함께 확정 |
| work | title, description, englishTitle, englishDescription, creatorBio, category, language, publicationStatus | 초안에서는 일부 누락 허용, 제출 단계에서 필수 검사 |
| assets | id, purpose, displayName, sizeBytes, state, pageCount, rejectionCode | 저장소 내부 키·영구 공개 URL은 응답에 포함하지 않음 |
| consentRequirements | documentId, version, locale, purpose, required, verificationMethod | 서버가 해당 접수에 필요한 요구를 반환 |

보호자 정보는 참가자가 입력한 값과 보호자 확인 완료 증적을 구분한다. 기관 기능 확장 때문에 첫 출시 폼에 불필요한 필드를 강제하지 않는다.

## 접수 상세 응답 구조

```json
{
  "data": {
    "id": "entry_example",
    "competitionId": "competition_example",
    "revision": 3,
    "entryStatus": "submitted",
    "receiptNumber": null,
    "submittedAt": "2026-12-31T14:58:00Z",
    "receivedAt": null,
    "payment": {
      "orderId": "order_example",
      "state": "pending",
      "amountMinor": 7000,
      "currency": "EUR"
    },
    "reviewStatus": "not_started",
    "publishedResult": null,
    "allowedActions": ["view_submission", "check_payment"],
    "blockingReasons": ["PAYMENT_PENDING"]
  },
  "meta": {
    "requestId": "request_example",
    "serverTime": "2026-12-31T14:58:01Z"
  }
}
```

예시는 상태 부분만 포함한다. participant/work/assets는 소유자용 상세 응답에 추가한다. `payment`는 주문 생성 전이면 null이다. 예시 ID와 시각은 실제 데이터가 아니다.

## 프런트엔드 동작

| 서버 상태 | 표시·조작 |
| --- | --- |
| draft | 이어서 작성. 저장 성공 응답의 revision으로 갱신 |
| submitted + payment pending | 결제 확인 중. check_payment 허용 시 재조회 |
| submitted + payment succeeded | 접수 확정 확인 중. 새 결제 버튼 노출 금지 |
| received | 접수번호 표시. 본인 내역 보기 |
| expired | 마감 또는 만료 안내. 서버가 허용한 행동만 노출 |
| publishedResult null | 발표 전 안내. 미선정으로 해석하지 않음 |
| certificate 발급 전 | 발급 대기. 가짜 다운로드 링크 생성 금지 |

`allowedActions` 제안: `edit`, `upload`, `submit`, `start_payment`, `check_payment`, `view_submission`, `download_certificate`. 버튼 숨김은 권한 방어가 아니며 서버도 같은 조건을 검증한다.

## 오류 코드

| HTTP | code | 화면 처리 |
| --- | --- | --- |
| 401 | UNAUTHENTICATED | 로그인 유도. 민감한 입력을 URL에 담지 않음 |
| 403 | FORBIDDEN | 접근 불가 |
| 404 | NOT_FOUND | 없거나 공개할 수 없는 대상 |
| 409 | REVISION_CONFLICT | 새 내용 확인 후 재수정, 자동 덮어쓰기 금지 |
| 409 | IDEMPOTENCY_CONFLICT | 중복 요청 키 충돌 |
| 409 | ENTRY_LOCKED | 제출 이후 수정 불가 |
| 409 | DEADLINE_PASSED | 마감 및 가능한 후속 행동 표시 |
| 409 | FILE_NOT_READY | 파일 검증 상태 확인 |
| 422 | VALIDATION_FAILED | 필드별 오류 표시 |
| 422 | CONSENT_REQUIRED | 필요한 문서·확인 절차 안내 |
| 413 | FILE_TOO_LARGE | 서버 제한 용량 안내 |
| 429 | RATE_LIMITED | Retry-After 기준 대기 |
| 503 | PAYMENT_UNAVAILABLE | 기존 지원서 보존, 재시도 안내 |
| 503 | POLICY_NOT_CONFIGURED | 운영 준비 전 결제 진행 차단 |

## 관리자와 심사 API

첫 계약 범위는 참가자 접수다. 관리자·심사 라우트는 역할과 화면 요구를 확인한 뒤 추가한다. 다음 원칙은 유지한다.

- 목록은 서버 페이지 처리와 권한 범위 필터를 적용한다.
- 심사 응답은 별도 DTO이며 이름·학교·연락처·결제·보호자 정보를 포함하지 않는다.
- 일괄 변경은 항목별 성공/실패, 변경 revision 및 감사 이력을 반환한다.
- 공개 결과 변경과 심사 점수 변경은 서로 다른 작업이다.
- 결제 승인 상태를 수동 편집하는 API를 제공하지 않는다.
