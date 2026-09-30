# 관리자 정책 변경 이력 조회

GET `/api/v1/admin/competitions/{competitionId}/submission-policy/history`

GET `/api/v1/admin/competitions/{competitionId}/payment-policy/history`

공통 `{data,meta}` 응답의 data는 `src/contracts/policy-history.ts`의 PolicyHistoryPageSchema를 따른다. items는 kind, revision, actorId, createdAt, policy를 포함하며 payment 이력은 routing도 포함한다. 현재 정책을 조합하지 않고 변경 당시 저장한 원문을 반환한다.

limit은 1~50(기본 20), cursor는 앞 페이지의 nextCursor 정수다. 공모 revision 내림차순으로 cursor보다 작은 기록을 읽는다. revision은 공모 정보와 공유하므로 정책별 이력 번호 사이가 비어 있을 수 있다. nextCursor=null이면 끝이다. 최신 변경을 보려면 커서 없이 다시 조회한다.

제출 정책 이력은 전체 공모 운영자, 결제 정책 이력은 해당 공모의 결제 viewer/operator만 볼 수 있다. 권한은 요청마다 확인한다. 비로그인 401, 무권한 403, 입력 오류 422이며 응답은 private,no-store다. 결제 정책에는 내부 가맹점 ID가 포함될 수 있으므로 공개 콘텐츠로 재사용하지 않는다. 참가자 개인정보나 PG 비밀 키를 추가로 조회하지 않는다.

읽기 전용이며 이전 정책 복원·수정·삭제 기능은 없다. 별도 DB 마이그레이션 없이 기존 016/017 감사 테이블을 사용한다. 이전 구현 문서의 ‘이력 조회 후속 범위’ 항목은 이번 변경으로 완료했다.

검증: 권한 분리·공모 범위·권한 회수·빈 목록·커서/limit 검증·revision 순서·원문 반환·no-store. 정책 저장 회귀 테스트 포함 3개와 전체 타입 검사·관련 ESLint 통과. 실제 운영 DB와 관리자 화면은 검증하지 않았다. 프런트 파일은 변경하지 않았다.
