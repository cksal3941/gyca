# 토스 승인·조회 어댑터 구현 현황

2026-09-15. 화면이나 Claude의 mock·어댑터는 변경하지 않았다.

후속 구현: [결제 재확인 작업](payment-recovery-implementation.md)에 DB 복구 큐와 스케줄러 호출 경로를 추가했다. 실제 자동 실행은 아직 연결하지 않았다.

## 이번 단계에서 구현한 것

- `src/server/payments/toss.ts`: 토스 승인·주문 조회·웹훅 재조회 어댑터와 제한된 HTTPS 전송 모듈.
- `POST /api/v1/orders/{id}/confirm`: 로그인 계정 소유 주문의 서버 승인 요청. JSON 본문은 `{ "paymentKey": "SDK 인증 결과의 참조" }`만 받는다.
- `006_payment_confirmations.sql`: 주문별 paymentKey, 서버 UUID 멱등키, 요청 시각과 재전송 가능 종료 시각을 변경 불가능하게 저장한다. 실제 DB에는 실행하지 않았다.
- 설정이 모두 준비된 경우에만 **토스 테스트 키**를 사용하는 런타임 연결을 추가했다. 기본은 disabled이며 라이브 키를 활성화하는 설정은 제공하지 않는다.

서버의 금액·주문 ID로 승인 요청을 만들며, 브라우저 가격을 사용하지 않는다. 성공 응답은 MID·주문·paymentKey·통화·금액·승인 시각을 검증하고 기존 결제 원장에 반영한다. 인증 중 상태는 pending이며 DONE만 결제 성공으로 정규화한다. 취소·부분 취소는 운영 확인 대상으로 남긴다. 환불 실행 기능은 없다.

## 토스 공식 규격과 구현 선택

공식 API는 승인 `POST /v1/payments/confirm`과 주문 조회 `GET /v1/payments/orders/{orderId}`를 제공한다. `approvedAt`은 시간대 오프셋을 포함할 수 있으므로 UTC로 정규화한다. [코어 API](https://docs.tosspayments.com/reference)

Basic 인증에는 비밀 키 뒤 콜론을 포함하며, 승인 요청에는 서버가 보관한 Idempotency-Key를 사용한다. 토스 멱등키의 문서상 유효기간은 15일이다. 해당 기간 이후에는 새 키로 승인을 재시도하지 않고 조회만 한다. [인증·멱등키 안내](https://docs.tosspayments.com/reference/using-api/authorization)

일반 PAYMENT_STATUS_CHANGED 알림에는 지급대행 이벤트의 서명 헤더 검증법을 적용할 수 없다. 알림의 주문 ID·paymentKey만 참조로 읽고 서버 비밀 키로 다시 조회한다. 알림이 주장하는 성공·금액·시각은 버린다. [웹훅 이벤트](https://docs.tosspayments.com/reference/using-api/webhook-events)

웹훅·승인·재조회에서 같은 관측 결과는 같은 정규화 이벤트 ID를 만든다. 토스의 추가 응답 필드와 카드 관련 개인정보는 원장에 복사하지 않는다. 이 단계는 NORMAL 결제와 PAYMENT_STATUS_CHANGED만 지원한다.

## 금액과 테스트 활성화

EUR 지원·가맹 계약은 아직 확인되지 않았다. 어댑터가 있다는 사실은 EUR 계약이 있다는 뜻이 아니다. **API 금액 단위에도 기본값을 주지 않았다.** 계약된 EUR 상품 규격을 확인해 `major` 또는 `minor`를 지정해야 한다. 내부 7000은 major 설정이면 70, minor 설정이면 7000으로 전달한다. 소수 센트나 안전한 정수 범위를 벗어나는 응답은 반올림하지 않고 거부한다. 다른 통화로 환산하지 않는다.

`.env.example`에 아래 항목을 추가했다. 실제 키나 계약 내용을 입력하지 않았다.

| 환경 변수 | 의미 |
| --- | --- |
| `GYCA_PAYMENT_PROVIDER` | 기본 disabled. 테스트 연결을 명시적으로 선택할 때만 `tosspayments-test` |
| `TOSS_TEST_MID` | 테스트 가맹점 ID |
| `TOSS_TEST_SECRET_KEY` | 해당 MID의 test 시크릿 키. 브라우저·Git·채팅에 노출하지 않음 |
| `TOSS_EUR_AMOUNT_UNIT` | 가맹 상품 규격으로 확인한 major/minor |
| `TOSS_EUR_APPROVAL_REFERENCE` | EUR 지원·단위 확인 기록의 참조. 참가자 동의나 비밀 키가 아님 |

누락·잘못된 키·live 키이면 어댑터는 활성화되지 않는다. 테스트는 별도 DB에서 진행해야 한다. 활성화 시에도 공모 payment_enabled, payment_policy, 제출 스냅샷, 마감 검사는 계속 적용된다. 테스트 키로 기록되는 received는 테스트 DB에서만 의미가 있다.

## 승인 재시도

1. DB에서 소유권·제출 상태·운영 결제 허용·마감을 검사하고 paymentKey와 멱등키를 먼저 보관한다.
2. 외부 API는 DB 트랜잭션 밖에서 호출한다. DB 잠금을 잡고 토스 응답을 기다리지 않는다.
3. 통신 오류·응답 불명확 시 주문과 키를 유지한다. 같은 paymentKey의 요청만 같은 멱등키로 재전송한다.
4. 결제 마감이나 보관된 재전송 종료 시각이 지난 기존 요청은 조회만 한다. 처음 요청하는 승인은 마감에 도달하면 차단한다.
5. 승인 결과가 이미 반영되었으면 추가 승인 요청 없이 현재 주문을 반환한다. 조회·웹훅으로 정상 승인을 회복할 수도 있다.

한 주문에 새로운 paymentKey로 교체하는 기능은 아직 없다. 사용자 입력 실수나 다른 카드 재인증으로 키가 바뀌면 409를 반환한다. 새 결제 시도를 허용하려면 기존 시도의 확정 실패·취소를 확인하는 별도 흐름이 필요하다. 불명확한 결제를 새 주문으로 우회하면 안 된다.

## Claude 연결 안내

- confirm은 추후 토스 SDK의 인증 반환을 처리할 서버 경로이며 결제 시작 버튼의 허가를 뜻하지 않는다. 현재 `allowedActions`에 결제 시작 액션을 추가하지 않았다.
- SDK 성공 페이지 도착만으로 received를 표시하지 않는다. confirm 후 주문 상태와 EntryDetail을 조회한다.
- confirm 본문에 amount, currency, state, 승인 시각을 추가하면 422다. 로그인 소유자와 Origin도 검사한다.
- 네트워크 오류 후 같은 paymentKey를 보존한다. 결과가 불명확하면 reconcile로 조회한다. 새 주문·새 키를 만들어 재결제하지 않는다.
- EUR용 SDK 파라미터·클라이언트 키, 성공·실패 페이지, 실제 결제창 UI는 아직 연결하지 않았다.

## 검증

전체 테스트 117건 통과. 로컬 HTTP 시험 서버를 통해 Basic 인증, 승인 본문, 멱등키, 상태·시간대·금액 변환, 위조 웹훅, 응답 크기 제한, JSON 오류, 리다이렉트 미추적을 검증했다. DB 통합 테스트는 동시 승인 요청, 통신 실패 후 같은 키 재시도, 마감 이후 조회만 수행, 15일 경계, 소유권과 접수 확정까지 확인한다.

전송 목적지는 `https://api.tosspayments.com`으로 고정했다. 요청 전체 제한 10초, 응답 상한 256 KiB, 자동 POST 재시도 없음. 공급자 오류의 원문·비밀 키를 응답이나 로그에 노출하지 않는다. HTTP 오류는 성공으로 변환하지 않으며, 승인 오류 뒤 정확한 상태는 재조회로 확인해야 한다.

전체 타입 검사·ESLint 통과. 실제 Next confirm 경로는 미설정 환경에서 503 POLICY_NOT_CONFIGURED, private/no-store를 확인했다.

실제 토스 샌드박스, TLS 연결, 가맹점 EUR 규격, 네트워크 PostgreSQL 다중 연결, 테스트 키로의 전체 결제 여정, 배포는 아직 검증하지 않았다. 테스트 데이터의 major 단위와 가맹점 참조는 운영 승인 근거가 아니다. 실운영 전에 웹훅 유입 제한, 자동 재확인, 환불·운영 처리, outbox worker도 필요하다.
