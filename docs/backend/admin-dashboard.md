# 관리자 운영 대시보드 집계

2026-09-19. 기획서의 총 회원·국가별 참가자·공모전별 지원·결제·접수·심사 현황을 실제 서버 집계로 제공한다.

## API

`GET /api/v1/admin/dashboard?limit=20&cursor=`

전역 `gyca_competition_editors` 운영자만 조회할 수 있다. 응답은 `src/contracts/admin-dashboard.ts`의 `AdminDashboardSchema`이며 `private, no-store`다. 공모전은 ID 오름차순의 불투명하지 않은 커서로 최대 50개씩 반환한다. 중복·알 수 없는 쿼리와 범위를 벗어난 limit은 422다.

## 집계 의미

- `accounts.total`: Better Auth 사용자 전체 수다. 참가자뿐 아니라 운영자·심사위원 계정도 포함한다.
- `applicants.uniqueAccounts`: 접수를 한 번이라도 만든 고유 계정 수다.
- `applicants.byResidenceCountry`: 계정별 가장 최근 접수 한 건의 거주 국가로 집계한다. 제출 건은 동결 snapshot을, 초안은 현재 값을 사용한다. 상위 250개 국가값을 건수 내림차순으로 반환한다.
- `applicants.unknownResidenceCountry`: 최신 접수에 국가가 비어 있는 계정 수다.
- `competitions.items[].entries`: 상태별 접수 건수와 고유 참가 계정 수다.
- `payments`: 주문 상태별 건수, 수동 검토 필요 건수, 성공 결제의 총 `amountMinor`다. 통화는 현재 계약상 EUR다. 성공 금액은 환불 차감 전 총승인액이며 정산액이나 순매출이 아니다.
- `reviews.notStarted/underReview/completed`: 접수 단위 심사 진행 상태다.
- `reviews.activeAssignments/submittedAssignments`: 회수되지 않은 심사위원 배정과 그중 제출 완료 배정 수다.
- `results`: 발표 전과 공개 결과별 접수 건수다.

공모 공개 콘텐츠에 유효한 영문·국문 제목이 없으면 `title=null`이다. 화면은 샘플 제목을 만들어 표시하지 않는다.

## 의도적으로 포함하지 않은 항목

기관 수는 제공하지 않는다. 현재 `school`은 참가자가 입력하는 문자열일 뿐 기관 계정이나 검증된 기관 엔터티가 아니므로, 고유 학교명 개수를 기관 수로 표시하면 잘못된 운영 지표가 된다. 단체접수·기관 관리가 구현될 때 별도 기관 테이블을 기준으로 추가한다.

참가자 이름·이메일·생년월일·학교명·보호자 정보, PG 식별자, 심사 코멘트는 반환하지 않는다. 상세 확인은 기존 권한 API를 사용한다.

## 성능과 검증

migration 034는 공모별 생성순·접수 상태·심사 상태·공개 결과 집계를 위한 인덱스를 추가한다. PGlite에서 인증·권한 회수, 입력 경계, 공모 페이지 이동, 최신 국가 선택, 빈 국가, 상태별 접수·결제·심사·결과, 동일 금액 두 성공 결제의 합산과 민감정보 비노출을 검증했다. 운영 PostgreSQL 데이터 규모의 실행 계획과 부하 검증은 아직 남아 있다.
