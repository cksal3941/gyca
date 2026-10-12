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

응답은 `PaymentCheckoutSessionSchema`다. `launch.kind`는 두 가지다.

- `redirect`: 공급자 호스팅 페이지. 브라우저는 HTTPS `url`로 이동만 한다.
- `tosspayments_sdk`(2026-10-10 추가): 토스페이먼츠 v2 브라우저 SDK(`https://js.tosspayments.com/v2/standard`)로 결제창을 연다. 서버가 고정한 `clientKey`, `customerKey`, `orderName`, `method=CARD`, `amount{currency,value}`, `successUrl`, `failUrl`만 담는다. 브라우저는 `TossPayments(clientKey).payment({customerKey}).requestPayment({...launch, orderId, windowTarget:"self"})`를 그대로 호출하며 금액·통화·주문·복귀 URL을 바꾸지 않는다. 공통 구현은 `src/lib/payments/launch.ts`.

비밀 키, 이메일, 내부 사용자 ID는 반환하지 않는다. 공급자에 필요한 고객 참조는 서버에서 계정·가맹점 범위를 해시한 64자리 불투명 값이며, 토스 `customerKey`는 그 앞 40자에 `gyca-`를 붙인 값이다. 세션의 주문·공급자·test/live 범위와 만료 시각을 서버가 다시 검사한다. 토스 세션의 `expiresAt`은 발급 후 30분과 주문의 결제 마감 중 이른 쪽이다.

결제창 이동은 결제 성공이 아니다. 토스는 `successUrl`(`/mypage/entries/{entryId}/payment/success`)에 `paymentKey, orderId, amount`를 붙여 돌려보낸다. 성공 페이지는 `orderId`가 해당 접수의 주문과 같을 때만 `POST /api/v1/orders/{orderId}/confirm {paymentKey}`를 한 번 보내고, 서버가 자기 원장의 금액으로 토스 승인 API를 호출해 검증한 뒤에야 `received`와 접수번호가 발급된다. `failUrl`(`/payment/fail`)은 `code, message`를 표시만 하고 confirm을 보내지 않는다. 웹훅·reconcile은 기존대로 동작한다.

## 현재 활성 상태

`GYCA_PAYMENT_PROVIDER=tosspayments`, `TOSS_MODE`, `TOSS_MID`, `TOSS_SECRET_KEY`, `TOSS_CLIENT_KEY`, HTTPS `BETTER_AUTH_URL`이 모두 있을 때만 토스 공급자가 `beginCheckout`을 제공하고 주문에 `start_payment`가 생긴다. 클라이언트 키나 HTTPS origin이 없으면 승인·웹훅·재조회만 동작한다. live 모드는 `TOSS_MODE=live`, live_ 키 2개, `TOSS_APPROVAL_REFERENCE`가 모두 있어야 하며 키 접두사가 모드와 다르면 비활성이다. 환경 변수 표는 [toss-adapter-implementation.md](toss-adapter-implementation.md).

통화: 토스 공식 문서상 일반 결제는 KRW, 해외 PayPal은 USD다. `TOSS_CURRENCY`(기본 KRW)와 다른 통화의 주문은 `POLICY_NOT_CONFIGURED`로 거부하며 환산하지 않는다. 이를 위해 공통 `MoneySchema`가 EUR/KRW/USD를 받고(최소단위 지수 EUR·USD=2, KRW=0), migration 040이 주문·환불 테이블의 통화 CHECK를 확장했다. 기존 EUR 주문은 소급 변경하지 않는다. KRW로 접수비를 받으려면 공모 정보의 참가비 통화를 KRW로, 결제 정책(routing)의 route `currency`도 KRW·`provider=tosspayments`·`merchantAccount=TOSS_MID`·`liveMode`를 모드와 맞춰 저장해야 한다.

## PayPal 해외간편결제(USD)

토스는 MID당 통화 하나를 청구하므로 PayPal은 `TOSS_PAYPAL_*` 별도 MID로 두 번째 공급자가 된다(id는 같은 `tosspayments`, merchantAccount가 다르다). 런타임은 `configuredTossProviders`로 공급자 목록을 주입하며 주문은 생성 당시 공급자 식별(id·MID·liveMode)에 묶인다. 웹훅은 알림의 `data.mId`를 자기 MID와 먼저 대조하고, 서비스는 공급자 순서대로 검증을 시도한다. 복구 큐는 MID별로 돈다.

PayPal 주문은 `launch.method=FOREIGN_EASY_PAY`, `amount.currency=USD`, `foreignEasyPay{provider:PAYPAL, country, products[1]}`를 내려준다. `country`는 브라우저가 아니라 제출 스냅샷의 거주국이며, 없으면 결제창을 열지 않는다. 디지털 서비스라 shipping은 보내지 않는다. 취소 본문에는 `currency`를 넣고, `cancelStatus`가 DONE이 아니면 환불 증거로 기록하지 않고 pending으로 둔다.

가격: 공모 정보에 `alternativeFees`(다른 통화의 고정 금액, 최대 2개)를 추가했다. 결제 경로는 그 경로 통화의 고정 가격이 제출 스냅샷에 있을 때만 노출되며(`PaymentOptions.routes[].money`), 주문은 그 금액을 그대로 청구한다. 환율 변환은 어디에도 없다. 관리자 공모 폼의 "해외 참가비"가 이 값을 편집한다.

접수 상세(`EntryDetail.allowedActions`)는 제출 후 결제 전이면 `start_payment`, 주문이 있으면 `check_payment`도 제공한다. 이 액션은 결제 페이지로의 진입만 뜻하며, 실제 버튼은 `payment-options`의 `create_order`와 주문의 `start_payment`(공급자가 실제로 결제창을 제공할 때만)로 다시 막힌다.

- [토스 결제창 SDK 파라미터](https://docs.tosspayments.com/sdk/v2/js/payment)
- [토스 SDK 키와 서버 금액 검증 원칙](https://docs.tosspayments.com/guides/v2/get-started/llms-quick-reference)
- [토스 웹훅 이벤트](https://docs.tosspayments.com/reference/using-api/webhook-events)

## 검증

PGlite 테스트에서 액션 노출, 정상 세션, 소유권·Origin·엄격한 빈 본문, 공급자 응답 바꿔치기, 마감 경계, 공급자 미설정, 토스 SDK 세션의 서버 고정 값·만료 상한·클라이언트 키 부재 시 액션 미노출을 검증한다(`tests/payment-checkout.test.mjs`, `tests/toss-adapter.test.mjs`). 실제 토스 테스트 키로 결제창→승인→received→환불을 완주하는 브라우저 검증은 외부 계정 준비 후 스테이징에서 별도로 수행해야 하며 아직 하지 않았다.
