# 관리자 접수 이메일 처리 상태 조회

GET `/api/v1/admin/competitions/{competitionId}/receipt-deliveries`

2026-09-16. 전체 공모 운영자 gyca_competition_editors만 접근할 수 있는 읽기 전용 API다. 공개/참가자 API가 아니며 실제 화면은 연결하지 않았다.

## 계약

공통 `{data,meta}` 응답의 data는 `src/contracts/receipt-admin.ts`의 ReceiptDeliveryPageSchema를 따른다. limit은 1~50(기본 20), cursor는 이전 nextCursor를 그대로 전달한다. 키 오름차순이며 시간순/고정 스냅샷이 아니다. 다음 페이지가 없으면 nextCursor=null이다.

items에는 entryId, orderId, entryStatus, state, attempts, nextAttemptAt, providerAcceptedAt, emailVerified, allowedActions가 있다.

- pending: 대기 또는 재시도 예약. nextAttemptAt은 서버 큐의 예정 시각이며 그 시각에 실제 발송된다는 보장이 아니다.
- running: 작업 임대 중. 프로세스가 실제로 살아 있는지까지 의미하지 않는다.
- provider_accepted: 메일 서비스가 발송 요청을 수락했다. 수신함 도착 확인이 아니다.
- stalled: 자동 재시도 중단. 원인 조사와 별도 운영 처리가 필요하다.

emailVerified는 현재 계정의 이메일 확인 여부다. false이면 기존 발송 작업이 선택하지 않을 수 있다. 발송 대상 주소 자체나 고정된 메일 내용은 노출하지 않는다. allowedActions는 빈 배열이며 수동 재발송 API는 없다. 전달 성공 웹훅도 아직 없다.

접수 상태는 entryStatus로 별도 반환한다. 메일 실패 때문에 received 접수가 취소되지 않으며, 메일 성공만으로 received라고 판단하지 않는다. 이 API는 entry_received 큐만 조회하며 결제 예외 알림은 제외한다. 발송 기능 플래그가 꺼져 있어도 기록은 조회 가능하다.

## 검증

비로그인 401, 무권한 403, 공모 없음 404, limit 오류 422, 공모별 목록·빈 목록·페이지 분할, 공급자 수락 상태, 중단/이메일 미확인 상태, 민감 필드 비노출, no-store를 확인했다. 기존 발송 작업 테스트 포함 10개와 전체 타입 검사·관련 ESLint 통과. 실제 메일 전달·운영 DB·관리자 화면은 검증하지 않았다. 프런트 코드와 접수 확정 로직은 변경하지 않았다.
