# 공모별 결제 운영 집계

GET `/api/v1/admin/competitions/{competitionId}/payment-health`

`@/contracts/payment-health`의 PaymentHealthSchema와 `{data,meta}` 응답을 사용한다. 공모별 결제 viewer/operator 권한이 필요하다. 비로그인 401, 권한 없음/회수 또는 권한 없는 공모는 403이다. 응답은 private,no-store이며 원본 주문·참가자·공급자 데이터는 반환하지 않는다.

- measuredAt: 이번 조회의 서버 기준 시각.
- orders: total 및 pending/succeeded/failed/cancelled/expired 상태별 수, needsReview 수.
- recovery: pending/running/completed/stalled 작업 수.
- recovery.due: pending이며 due_at이 measuredAt 이하인 작업 수.
- recovery.expiredLeases: running이며 점유 만료 시각이 measuredAt 이하인 작업 수.
- recovery.oldestDueAt: due 작업 중 가장 이른 due_at. 없으면 null.

주문/작업 집계는 한 SQL에서 해당 공모 범위로 읽는다. needsReview는 주문 상태별 수와 중복될 수 있고, due/expiredLeases는 각각 pending/running의 부분 집합이므로 모두 합산하지 않는다. 주문이나 작업이 없으면 0과 null이다. 모든 수는 DB 원장 기준이며 test/live 또는 PG별 필터는 없다. 따라서 실매출·정산 보고서로 사용하지 않는다. 아직 복구 큐가 생성되지 않은 주문은 recovery 수에 포함되지 않는다.

due는 실행 가능 시각이 지났다는 뜻이며 그 자체가 장애 판정은 아니다. expiredLeases도 다음 작업자가 회수할 수 있는 상태로, 결제 실패나 접수 만료를 뜻하지 않는다. 이 API는 PG 호출·큐 실행·권한 변경을 수행하지 않는다. 관리자 작업 버튼은 기존 단건 API의 allowedActions를 따른다. 운영 화면에서 과도한 반복 호출을 피하고 수동 새로고침부터 연결한다.

2026-09-16 관련 테스트 13개·전체 타입 검사·변경 파일 ESLint 통과. 공모 범위, 빈 집계, due/lease 정확 경계와 미래 작업 제외, 권한 회수, 민감 정보 비노출을 검증했다. 실제 PostgreSQL 부하·동시성·스케줄러 실행 여부는 이 결과로 확인되지 않는다.
