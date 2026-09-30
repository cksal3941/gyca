# 결제 환불 원장과 관리자 API

2026-09-19. 원결제 상태를 되돌리지 않고 부분·전체 환불을 별도 원장으로 기록한다.

## API

- `GET /api/v1/admin/competitions/{competitionId}/payments/{orderId}/refunds`
- `POST /api/v1/admin/competitions/{competitionId}/payments/{orderId}/refunds`

GET은 `RefundOverview`를 반환한다. 원결제 금액, 성공 환불 합계, 처리 중 합계, 남은 환불 가능액, 환불 이력과 `allowedActions`가 있다. viewer는 조회만 가능하다. operator이면서 검증된 성공 결제이고 review 대상이 아니며, 해당 주문과 정확히 일치하는 공급자에 refund 기능이 설정된 경우에만 `request_refund`가 나온다.

POST 본문은 `{actionId,amountMinor,reason}`이다. 금액·통화·paymentKey·공급자 정보는 화면이 결정하지 않는다. `actionId`는 UUID이며 공급자 멱등키로도 그대로 사용한다. 같은 actionId와 같은 요청은 같은 환불을 반환하고 내용이 바뀌면 409다.

## 안전 경계

- 성공 결제만 환불할 수 있고 `needsReview=true` 주문은 차단한다.
- pending과 succeeded 환불 합계는 원결제 금액을 넘을 수 없다. 주문 행 잠금 안에서 합계를 검사해 동시 요청도 직렬화한다.
- 공급자 호출 전에 pending 원장을 저장한다. 응답 유실·타임아웃은 성공/실패를 추측하지 않고 pending을 유지한다.
- pending 재시도는 같은 actionId와 같은 금액·사유만 허용하며 공급자에도 같은 멱등키를 보낸다.
- 공급자 환불 ID·주문 ID·paymentKey·금액·통화·시각을 검증한 뒤에만 succeeded로 바꾼다.
- 참가자 `GET /orders`의 `refundSummary`는 환불 원장에서 집계한다. pending이 하나라도 있으면 성공분을 포함한 예약 합계를 pending으로, 처리 중이 없으면 성공 합계를 succeeded로 표시한다.
- 환불 성공은 기존 접수번호·received 상태나 원결제 succeeded를 되돌리지 않는다.

Toss 어댑터는 공식 취소 API `POST /v1/payments/{paymentKey}/cancel`을 사용하고 서버가 계산한 cancelAmount와 200자 이내 사유, 안정적인 Idempotency-Key만 보낸다. 테스트 설정이 완전하지 않으면 공급자 기능 자체가 없어 API가 503으로 닫힌다. 실계약·EUR 취소·부분 취소 가능 여부와 운영 키는 아직 검증하지 않았다.

## 저장과 검증

migration 031의 `gyca_refunds`는 요청 조건을 변경할 수 없고 성공 증거가 기록된 환불은 되돌릴 수 없다. provider 응답 원문이나 카드 정보는 저장·응답하지 않는다.

PGlite 및 로컬 HTTP 공급자 검사로 권한·공모 범위·Origin·엄격한 본문, 부분 환불, 전액 한도, 동시 합계 경계, 멱등 재시도, 불명확 응답의 pending 유지, 공급자 미설정 기본 차단, 참가자 주문 요약과 Toss 취소 요청을 검증한다. 실제 Toss 네트워크 환불은 수행하지 않았다.
