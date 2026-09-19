# 결제창 시작 계약

2026-09-18. 실제 결제 공급자를 붙이기 전에 브라우저와 공급자 사이의 경계를 고정했다.

## API

`POST /api/v1/orders/{orderId}/checkout`, JSON `{}`.

로그인한 주문 소유자와 동일 출처 요청만 허용한다. 주문 금액·통화·사용자·상태는 본문에서 받지 않는다. 서버가 보관한 변경 불가능한 주문을 다시 읽고 다음 조건을 모두 확인한다.

- 주문 공급자·가맹점·test/live 범위가 현재 런타임과 일치
- 주문과 접수가 각각 `pending`, `submitted`
- 운영 확인 대상이 아님
- 배타적 결제 마감 전이며 공모 결제가 활성화됨
- 해당 공급자에 서버 checkout 기능이 실제 구성됨

응답은 `PaymentCheckoutSessionSchema`이며 브라우저가 열 수 있는 HTTPS redirect URL만 포함한다. 비밀 키, 이메일, 내부 사용자 ID는 반환하지 않는다. 공급자에 필요한 고객 참조는 서버에서 계정·가맹점 범위를 해시한 64자리 불투명 값이다. 세션의 주문·공급자·test/live 범위와 만료 시각을 서버가 다시 검사한다.

결제창 이동은 결제 성공이 아니다. redirect 이후에도 기존 confirm·웹훅·reconcile 중 하나가 공급자 서버에서 금액과 주문을 검증해야 `received`와 접수번호가 발급된다.

## 현재 활성 상태

런타임에 hosted checkout을 구현한 공급자는 아직 없다. 따라서 실제 환경에서는 이 API가 `PAYMENT_UNAVAILABLE`로 닫혀 있고 주문의 `start_payment` 액션도 노출하지 않는다. 계약된 EUR 공급자 어댑터가 `beginCheckout`을 제공할 때만 액션이 생긴다.

현재 토스 문서의 일반 결제 통화는 KRW이며 해외 PayPal은 USD만 지원한다고 안내한다. GYCA의 EUR 금액을 토스에 임의 전송하지 않는다. 가맹 계약에서 EUR 지원이 서면 확인되거나 EUR 지원 PG가 선택될 때까지 토스 승인 어댑터도 테스트 전용으로 유지한다.

- [토스 결제창 통화 안내](https://docs.tosspayments.com/en/integration)
- [토스 SDK 키와 서버 금액 검증 원칙](https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference)

## 검증

PGlite 테스트에서 액션 노출, 정상 세션, 소유권·Origin·엄격한 빈 본문, 공급자 응답 바꿔치기, 마감 경계, 공급자 미설정을 검증한다. 실제 PG 세션 생성과 브라우저 redirect는 외부 계정 준비 후 스테이징에서 별도로 검증한다.
