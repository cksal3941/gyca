# 새 접수 중단 API

## 후속 통합 검증

tests/paused-payment-flow.test.mjs에서 실제 접수 저장·제출 서비스로 제출을 만든 뒤 관리자 중단 API를 호출했다. 새 초안 생성·수정·업로드 요청·최종 제출 차단과, 기존 제출 건의 경로 선택 주문 생성→PG 테스트 공급자 승인→received 및 접수번호 발급을 한 DB 흐름에서 확인했다. 승인 요청 재호출에도 공급자 승인 호출은 1회, 접수번호와 entry_received 알림 작업도 하나만 유지했다.

추가 통합 테스트 1개와 관련 ESLint 통과. 이 검증은 PGlite와 가짜 PG 공급자를 사용했고 파일은 이미 검사를 마친 자산 fixture로 넣었다. 실제 S3·PG·이메일 전송 또는 운영 PostgreSQL 동시성 검증은 아니다. 제품 코드 수정 없이 회귀 테스트를 추가했다.

POST `/api/v1/admin/competitions/{competitionId}/pause-applications`

요청 `{revision,reason}`. 응답 data는 competitionId, revision, draftEnabled=false, paymentEnabled다. 공통 타입은 `src/contracts/application-pause.ts`에 있다. 전체 공모 운영자 권한, 실제 세션, 동일 Origin이 필요하다.

현재 revision과 일치할 때만 draft_enabled를 false로 바꾸고 revision을 올린다. 마이그레이션 018의 감사 테이블에 이전 활성 여부·담당자·사유·시각을 같은 트랜잭션으로 기록한다. 기록 실패 시 변경도 롤백한다. 같은 이전 revision으로 다시 보내면 409다. 응답 유실 시 공모 조회로 상태를 확인하고 맹목적으로 재시도하지 않는다.

## 영향

- 이후 새 접수 생성, 초안 수정, 신규 업로드/완료 요청, 신규 최종 제출은 기존 접수 게이트에 의해 차단된다.
- payment_enabled, 공개 여부, 마감 시각, 접수 원장·접수번호·파일을 변경하지 않는다. 제출된 건의 주문 생성과 결제 확인·복구는 기존 결제 조건을 그대로 따른다.
- 중단 전에 시작한 트랜잭션이나 파일 검사가 먼저 완료될 수 있다. 이미 발급한 S3 서명 URL은 만료 전 사용 가능할 수 있으며 즉시 폐기하지 않는다. 업로드된 바이트가 있다는 것과 제출 완료는 다르다.
- 중단 이유는 내부 감사용이며 참가자에게 그대로 공개하지 않는다. 현재 공개 API는 POLICY_NOT_CONFIGURED로 차단을 알리고, 장애 안내 문구·별도 공개 상태 코드는 추가하지 않았다.

## 접수 재개

POST `/api/v1/admin/competitions/{competitionId}/resume-applications`

요청은 `{revision,reason}`이다. 최신 revision, 실제 운영자 권한, 이전에 활성 상태에서 생성된 중단 기록, 공개 콘텐츠·폼 처리 가능 여부와 공모 단계를 다시 확인한다. 예정 또는 접수 중인 공모만 재개하며 마감·심사·결과·보관 단계는 거부한다. `payment_enabled`는 변경하지 않는다.

마이그레이션 021에 재개 사유와 연결된 중단 revision을 변경 불가능하게 남긴다. 감사 기록 실패 시 `draft_enabled` 변경도 롤백한다. 공모 설정을 수정하거나 접수를 처음 여는 API가 아니며, 긴급 중단 전 활성 상태를 복구하는 용도다. 이번에는 실제 공모를 중단하거나 재개하지 않았고 프런트도 수정하지 않았다.

검증: 중단·재개 권한, Origin, 입력, 없는 공모, revision 충돌, 정책/기간 검사, 감사 실패 롤백, 이력 불변, 결제/공개 플래그 유지를 확인했다. 실제 운영 DB의 진행 중 요청과 S3 URL·PG 동시 처리 검증은 남아 있다.
