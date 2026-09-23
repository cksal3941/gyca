# 프런트엔드 검토에 대한 결정 v0.2

대상: `../frontend-notes-for-backend.md`의 A~E. 상태: 구현 기준으로 사용할 협업 결정. 실제 API는 아직 구현되지 않았다. 이 문서는 기존 초안과 충돌하는 항목에 우선한다. Claude의 검토 문서는 이력으로 보존한다.

## 1. 합의 및 파일 담당

- A1~A4는 해결됐다. 접수·심사·공개 결과를 분리하고 금액은 amountMinor, 동작은 allowedActions, 접수번호는 received 확정에서 발급한다.
- 결제·환불은 위 세 축과 별도로 유지한다. 주문 생성 전 payment는 null이며, paid/required/refunded를 원결제 enum에 다시 혼합하지 않는다.
- Codex는 `src/contracts/`의 전송 타입·공통 코드 목록과 서버 입력 검증을 담당한다.
- Claude는 `src/lib/api/`의 프런트 어댑터 및 인터페이스, `src/lib/mock/`, 화면 컴포넌트를 담당한다.
- `src/lib/types.ts`를 사용한다면 화면 전용 모델 또는 공통 타입의 재수출만 둔다. 같은 Entry/Competition/Money enum을 별도로 선언하지 않는다.
- 공통 타입 파일 생성 전에는 이 문서에 따른 fixture 구조와 UI를 준비할 수 있다. 컴파일 가능한 mock 인터페이스 연결은 공통 타입을 받은 뒤 완료한다.
- API 필드 원본은 공통 계약, EN/KO 문구·레이아웃은 Claude 소유다. 서버 message는 사용자용 번역의 기준이 아니다.

## 2. A5 및 Q3 본선 참가 확정

본선 참가 여부는 심사 결과와 별개인 `finalParticipation`으로 표시한다.

| state | 의미 |
| --- | --- |
| not_available | 현재 참가 확정 절차 미제공 또는 대상 아님 |
| invited | 공개된 본선 초대가 있고 아직 확정 전 |
| confirmation_pending | 신청 의사를 접수하고 운영 확인 중 |
| confirmed | 서버가 본선 참가 확정을 기록함 |
| declined | 참가 거절 기록 |

응답 필드: `state`, `invitationPublishedAt`, `confirmedAt`, `orderId`(각 시각·주문 참조는 해당 없으면 null). 불필요한 개인정보나 미발표 초대는 반환하지 않는다.

첫 출시 기본은 finalist 결과와 안내 표시까지다. 본선 확정 UI는 state를 표시할 수 있도록 준비하되 실제 확정 변경 API·본선 청구는 후속 범위다. 현재 계약의 allowedActions에 본선 확정 동작을 추가하지 않는다. 따라서 finalist라는 이유만으로 활성화된 확정·본선 결제 버튼을 만들지 않는다. confirmed는 프런트 클릭만으로 변경할 수 없다.

후속 단계에서 €0 전액 지원 등 결제 불필요 사례도 별도 고려한다. confirmed를 본선 결제 성공과 동의어로 정의하지 않는다.

## 3. B1 공모 공개 데이터

### 상태와 액션

`status`: upcoming / open / closed / judging / result / archived. 서버가 현재 시각, 공모 운영 단계, 공개 결과에 따라 산정한다. 미공개 공모는 공개 API에 포함하지 않는다. archived는 최우선이고 신규 접수를 허용하지 않는다. 공모 status를 브라우저 시계로 계산하지 않는다.

`readiness`: `{ application: boolean, payment: boolean }`. 내부 공급자 설정이나 비밀 값을 노출하지 않고 사용 가능 여부만 반환한다. 공고상 open이어도 준비 미완료일 수 있으며 CTA는 `allowedActions`를 기준으로 한다.

공모 allowedActions: `start_entry`, `view_guidelines`. readiness는 안내용이며 UI가 readiness와 status를 조합해 새 액션을 만들어서는 안 된다. 접수 완료가 보장되지 않는 준비 기간에 공개 접수를 시작하는 정책은 운영에서 결정한다.

시간: `opensAt`, `submissionClosesAtExclusive`, `paymentClosesAtExclusive`는 UTC ISO 문자열 또는 미확정이면 null. `timezone`은 Asia/Seoul과 같은 IANA 식별자. 마감 시간 정책 확정 전 sample datetime을 실운영 마감값으로 쓰지 않는다. 공고 문구는 별도 localized deadlineLabel로 보존 가능하다.

### 날짜와 출품 규격

- `keyDates[]`: `{ id, label: {en, ko}, value, timezone }`.
- value는 null, `{kind: date, date: YYYY-MM-DD}`, `{kind: instant, at: ISO}`, `{kind: date_range, startsOn: YYYY-MM-DD, endsOn: YYYY-MM-DD}` 중 하나다. 전시 기간 같은 종일 날짜를 자정 UTC 시각으로 바꿔 표시하지 않는다.
- `formSpec`: `{ version, categories, ageGroups, fields, uploads, ageReferenceDate }`.
- categories: `{id, label: {en, ko}}[]`.
- ageGroups: `{id, label: {en, ko}, minAgeInclusive, maxAgeInclusive}[]`.
- fields: `{path, inputType, requiredOnSubmit}[]`. requiredOnSubmit은 boolean 또는 미확정이면 null. 첫 출시 지원 path와 inputType은 공통 타입에서 제한하며 임의 코드 실행이나 HTML 주입을 허용하지 않는다.
- uploads: `{purpose, requiredOnSubmit, allowedMediaTypes, maxFiles, maxBytes, minPages}` 배열. 미확정 제한은 null. 첫 출시 단일 작품 PDF의 maxFiles=1, minPages=20. maxBytes는 미확정.
- 규격의 미확정 필수 정책이 남으면 실접수 제출을 허용하지 않는다. 임시저장은 별도 정책으로 분리한다.

### 전시 및 공모요강

`exhibition`: `{approvalStatus: pending|approved, displayName: {en, ko}, venueName, logoUrl, period}`. 승인 전 공식 명칭·로고는 공개 응답에서 제거한다. approved 이후에도 별도로 공개 승인된 값만 반환한다. 공개 UI가 내부 승인 전 데이터를 받고 CSS로 숨기지 않는다. pending에는 예정 문구를 반환한다.

`guidelines`: null 또는 `{url, locale, version}`. 공개 승인된 요강만 제공하며 없으면 다운로드 CTA를 제공하지 않는다.

## 4. B2 및 Q6 참가자

- name: 참가자 원어 이름.
- nameEn: 국제 표기·인증서용 이름 필드로 추가한다. ASCII만 허용하는 제한은 두지 않는다. 필수 여부는 운영 확인 전 null 정책으로 남긴다.
- school, grade: 선택 입력 필드로 제안한다. 필수 수집 근거가 정해지기 전 강제하지 않는다.
- dateOfBirth: 날짜. 브라우저나 사용자가 ageGroup을 확정하지 않는다.
- ageGroup: 서버가 ageReferenceDate에 따른 만 나이로 산정하는 읽기 전용 값 또는 null. 기준일 미확정 상태에서 현재 나이로 대체하지 않는다.
- residenceCountry와 nationality는 구분한다. 둘 다 수집해야 하는지는 최종 폼 정책에서 검토한다.
- 이 필드는 소유자 상세·허용된 운영자 응답에만 포함한다. 공개 수상작 및 심사 API에 그대로 재사용하지 않는다.

## 5. Q1과 Q2는 운영 미확정

Q1 마감 경계와 유예는 기존 domain-and-policy.md의 결정 항목을 유지한다. 마감과 검증 지연을 처리할 계약은 만들 수 있지만 임의 유예시간을 지정하지 않는다.

Q2 보호자 확인은 체크박스만으로 완료된다고 가정하지 않는다. UI 계약에는 `guardianVerification: {method, status}`를 마련한다.

- method: not_configured / checkbox / email. 최종 공급 방식에 따라 확장 가능하나 현재 실제 이메일 발송을 의미하지 않는다.
- status: not_required / required / pending / verified / failed / expired.
- 보호자 확인이 필요한데 방식이 미확정이면 method=not_configured, status=required이고 제출을 막는다.
- method와 status는 서버 응답이며 참가자가 verified를 PATCH할 수 없다.
- 이메일 확인 화면은 mock에서 상태를 표현할 수 있으나 실제 전송·재전송 버튼은 후속 API 계약까지 연결하지 않는다.

홈·상세·입력·오류 화면은 Q1/Q2 확정 전에도 구현할 수 있다. 실접수·실결제 개시에는 확정이 필요하다.

## 6. B3 마이페이지

기존 계약에 다음을 추가한다. 모두 로그인 소유자의 데이터만 반환하며 cursor/limit과 최대 페이지 크기 제한을 사용한다.

| 메서드 / 경로 | 응답 목적 |
| --- | --- |
| GET `/api/v1/orders` | 본인 주문과 결제·환불 요약 목록. 필터로 entryId 가능 |
| GET `/api/v1/certificates` | 공개·발급된 본인 인증서 집계. entry 순회 불필요 |
| GET `/api/v1/competitions` | 공개 공모 목록. archived 등 status 필터 가능 |

주문 요약은 id, entryId, competitionTitle, workTitle, kind(entry_fee/final_participation), money, paymentState, refundSummary, createdAt를 포함한다. final_participation은 후속 주문 유형이며 현재 생성하지 않는다. 환불 상태는 원결제 승인과 분리한다.

인증서 요약은 id, entryId, competitionTitle, workTitle, stage, issuedAt, allowedActions를 포함한다. 상시 공개 PDF 주소를 반환하지 않는다.

개인정보 탭은 기존 `/settings`로 연결한다. 계정 프로필 수정과 지원서 스냅샷 변경은 별개다. 기존 계정 수정이 이미 제출한 작품의 이름·동의를 자동 변경하지 않는다. 계정 삭제와 신규 접수 DB 관계는 Codex가 후속 구현 시 점검한다.

이어쓰기는 기존 `edit` 액션을 사용한다. `delete_draft`, `withdraw`는 이번 계약의 허용 액션에 추가하지 않는다. 삭제·철회 정책/API가 없는데 버튼만 만드는 것을 피한다. withdrawn 상태는 향후 운영 처리를 위해 보존한다.

## 7. Q4와 Q5 공개 콘텐츠 소유

첫 화면 작업은 구조화한 정적 콘텐츠 어댑터로 진행한다. 이는 mock 테스트 데이터와 구별한다. 실제 자료는 출처·승인 여부를 함께 관리하고, 자리표시자·가상 실적은 프로덕션에 게시하지 않는다.

- Claude: 홈·상세·About·News·Partners·전시·클림트 빌라의 섹션 렌더링, EN/KO 문구와 구조화한 콘텐츠 fixture.
- Codex: 이후 CMS 저장·공개 권한·공개 데이터 전달. CMS 제품·관리 UI는 아직 확정하지 않는다.
- Winners는 향후 공개 승인된 결과 및 작품 DTO에서 제공한다. 참가자 데이터 전체를 공개 데이터로 사용하지 않는다. 실제 수상작 자료가 없으면 빈 상태로 둔다.
- 상세 설명과 지원금 표는 우선 DOCX 기반 데이터로 분리한다. 비용·제출 필수 규칙·마감은 서버 공모 규격이 권위 있는 값이며 프런트 본문과 독립적으로 수동 변경하지 않도록 후속 CMS에서 연결한다.
- 첫 출시 화면 준비에 완성된 CMS를 요구하지 않는다. 운영자가 수정해야 하는 콘텐츠 범위와 CMS 완료 기준은 후속 단계에서 별도 확정한다.

## 8. 공통 코드 카탈로그 v0.2

이 목록은 현재 접수 API 범위의 카탈로그다. PG·심사 후속 기능에서 추가될 수 있다. 알 수 없는 코드는 범용 오류 문구로 표시한다. 클라이언트는 코드에 따라 권한을 새로 계산하지 않는다.

### blockingReasons

NOT_OPEN_YET, DEADLINE_PASSED, COMPETITION_ARCHIVED, POLICY_NOT_CONFIGURED, PAYMENT_UNAVAILABLE, ENTRY_LOCKED, REQUIRED_FIELDS_MISSING, FILE_NOT_READY, CONSENT_REQUIRED, GUARDIAN_VERIFICATION_REQUIRED, PAYMENT_REQUIRED, PAYMENT_PENDING, RECEIPT_PENDING.

blockingReasons는 어떤 단계가 진행되지 않는 이유를 설명하며 모든 액션을 일괄 비활성화하는 값이 아니다. PAYMENT_REQUIRED 상태에서도 start_payment는 허용될 수 있다.

### 파일 rejectionCode

FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, CONTENT_TYPE_MISMATCH, FILE_CORRUPTED, PDF_ENCRYPTED, PDF_TOO_FEW_PAGES, FILE_UNSAFE.

검증 인프라 타임아웃은 문서 자체가 잘못됐다는 rejectionCode로 만들지 않는다. validating 상태를 유지하고 작업 오류와 재시도 여부를 별도로 관리한다. PDF_ENCRYPTED의 운영 허용 여부는 추후 확정하되 코드와 UI 번역은 준비한다.

### fieldErrors[].code

REQUIRED, INVALID_FORMAT, TOO_LONG, INVALID_CHOICE, INVALID_DATE, AGE_OUT_OF_RANGE.

### error.code

UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, ENTRY_LOCKED, DEADLINE_PASSED, NOT_OPEN_YET, COMPETITION_ARCHIVED, FILE_NOT_READY, VALIDATION_FAILED, CONSENT_REQUIRED, GUARDIAN_VERIFICATION_REQUIRED, FILE_TOO_LARGE, RATE_LIMITED, PAYMENT_UNAVAILABLE, POLICY_NOT_CONFIGURED, INTERNAL_ERROR.

HTTP 변경 요청 오류는 기존 api-contract.md의 구조를 사용한다. 새 접근 충돌 코드는 409, 보호자 확인 누락은 422, INTERNAL_ERROR는 500이다. 공급자 내부 코드와 에러 원문은 그대로 공개하지 않는다.

## 9. Claude의 다음 작업

mock 토대와 HOME 작업을 진행해도 된다. 공통 타입의 중복 정의는 피하고 미확정 정책은 준비 중/미정으로 표현한다. 다음 fixture를 준비한다.

1. upcoming / open-ready / open-not-ready / archived 공모.
2. draft, 필수 자료 누락, 파일 validating 및 PDF_TOO_FEW_PAGES.
3. submitted + pending, submitted + succeeded + RECEIPT_PENDING, received.
4. 미발표 결과 null, official_selection, finalist + finalParticipation.not_available.
5. 본인 인증서·주문 목록의 빈 상태와 오류.
6. 보호자 확인 방식 미확정, 이메일 확인 대기(개발용), 동시 수정 충돌.

운영값에 대한 사용자 확인은 Q1 마감·유예, Q2 보호자 검증, Q6 이름 필수 여부·나이 기준일로 묶어 추후 받는다. mock·홈 작업을 위한 사전 승인 요청으로 삼지 않는다.
