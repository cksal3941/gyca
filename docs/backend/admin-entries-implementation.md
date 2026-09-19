# 관리자 공모별 접수 목록

2026-09-19. 공모별 접수·결제·심사·결과·파일·인증서 운영 상태를 한 목록에서 읽는 API다. 참가자·심사위원용 데이터로 재사용하지 않는다.

## 계약

GET `/api/v1/admin/competitions/{competitionId}/entries`

응답 data는 `AdminEntriesPageSchema`의 `{items,nextCursor,total}`이다. total은 현재 검색·필터에 맞는 전체 건수이며 현재 페이지 수가 아니다.

쿼리:

- `q`: 참가자명, 표시 작품명, received 접수번호의 대소문자 무시 부분 검색. 최대 200자.
- `entryStatus`: draft/submitted/received/withdrawn/expired.
- `paymentState`: pending/succeeded/failed/cancelled/expired. 주문이 없는 행은 어떤 결제 상태 필터에도 포함하지 않는다.
- `publishedResult`: official_selection/finalist/not_selected 또는 `not_announced`.
- `sort`: `created_desc`(기본), `created_asc`, `name_asc`.
- `cursor`: 응답의 불투명 nextCursor. 검색·필터·정렬 변경 시 버리고 첫 페이지부터 조회한다.
- `limit`: 1~50, 기본 20.

각 item은 기존 접수·결제 필드와 함께 `workTitle`, `category`, `ageGroup`, `reviewStatus`, `publishedResult`, `fileState`, `certificateIssued`, `allowedActions`를 제공한다. category/ageGroup은 표시 번역이 아닌 제출 정책 ID다.

## 집계와 액션

제출된 건의 참가자명·작품·분야·연령대는 현재 초안이 아니라 제출 스냅샷에서 읽는다. 파일 상태는 삭제되지 않은 현재 파일을 집계한다. rejected가 하나라도 있으면 rejected, 그다음 validating, pending/uploaded, 전부 ready 순서다. 파일이 없으면 pending이다.

`certificateIssued`는 한 장 이상 발급 완료됐는지 나타낸다. 현재 공개 단계의 인증서가 아직 없고 결과가 official_selection/finalist이면 `issue_certificate`를 제공한다. 제출 기록이 있는 건에만 `view_guardian_consents`를 제공한다. 결과 발표는 공모 전체 라운드 API이므로 행별 `publish_result` 액션을 만들지 않는다. 결제 상태 변경 액션도 없다.

페이지 커서는 정렬값과 entry ID를 함께 묶은 키셋 커서다. 정렬이 다른 커서를 재사용하면 422다. 같은 생성 시각이나 같은 참가자명이 여러 건이어도 중복·누락 없이 이어진다. 커서는 권한 토큰이 아니며 매 요청 권한과 필터를 다시 검사한다.

## 권한과 제한

공모 운영자 권한을 실제 세션으로 매 요청 확인한다. 비로그인 401, 무권한/권한 회수 403, 공모 없음 404, 중복·잘못된 쿼리 422다. 응답은 private,no-store다. 생년월일·보호자 연락처·가맹점 ID·결제 키·파일 URL은 반환하지 않는다.

PGlite에서 권한, 공모 분리, 전체 건수, 검색, 세 상태 필터, 세 정렬, 커서-정렬 결속, 파일 집계, 심사·공개 결과, 인증서 발급 전후 액션, 민감정보 비노출을 검증했다. 실제 PostgreSQL 데이터 규모의 검색·정렬 성능과 브라우저 연결은 아직 검증하지 않았다.
