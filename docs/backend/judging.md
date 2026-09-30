# 블라인드 심사 서버 기반

2026-09-19. 공모별 심사표, 심사위원 배정, 배정 범위 전용 조회, 임시저장과 최종 제출을 migration 025에 추가했다. migration 026은 심사위원 계정 상태 이력과 블라인드 PDF 변환·수동 승인 이력을, migration 027은 배정 목록·회수·재배정 이력을 추가한다.

## API

관리자:

- GET/PUT `/api/v1/admin/competitions/{competitionId}/review-rubric`
- POST `/api/v1/admin/competitions/{competitionId}/judge-assignments`
- GET `/api/v1/admin/competitions/{competitionId}/judge-assignments?limit=50&cursor=...`
- POST `/api/v1/admin/competitions/{competitionId}/judge-assignments/{assignmentId}/revoke`
- POST `/api/v1/admin/competitions/{competitionId}/judge-assignments/{assignmentId}/reassign`
- GET `/api/v1/admin/judges`
- PUT `/api/v1/admin/judges/{userId}`
- GET `/api/v1/admin/competitions/{competitionId}/judge-assignments/{assignmentId}/blind-asset`
- POST `/api/v1/admin/competitions/{competitionId}/judge-assignments/{assignmentId}/blind-asset/approve`

심사위원:

- GET `/api/v1/judge/assignments`
- GET `/api/v1/judge/reviews/{reviewId}`
- PUT `/api/v1/judge/reviews/{reviewId}/draft`
- POST `/api/v1/judge/reviews/{reviewId}/submit`

## 배점과 배정

코드에 배점을 고정하지 않는다. 운영자는 criterion ID·표시명·설명·최대 점수와 제출 후 수정 허용 여부를 공모별 rubric으로 먼저 저장한다. 최초 배정이 생성되면 해당 rubric은 잠기며 배정은 그 version을 고정한다.

배정 생성에는 실제 등록·활성 상태의 심사위원, `received` 접수, 블라인드 코드와 actionId가 필요하다. 동일 actionId와 동일 요청은 같은 배정을 반환하고 내용이 달라지면 충돌한다. 배정과 rubric 변경 이력은 삭제·수정할 수 없다.

관리자 목록은 심사위원 계정, 접수번호, 블라인드 코드, rubric 버전, 심사 revision, 블라인드 파일 상태, 회수 사유와 서버가 허용한 동작을 페이지 단위로 반환한다. `not_started`는 단독 회수 또는 재배정할 수 있고, `in_progress`는 다른 활성 심사위원에게 한 트랜잭션으로 재배정할 수만 있다. `submitted`, 결과 공개·보관 단계, 이미 회수된 배정은 변경할 수 없다. 요청은 현재 심사 상태와 revision, 사유, actionId를 요구한다.

회수는 기존 행과 임시 점수·코멘트를 삭제하지 않는다. 불변 회수 이력을 추가하고 기존 심사위원의 목록·상세·저장 접근을 즉시 차단하며, 진행 전 블라인드 변환 작업은 중단한다. 재배정은 같은 접수와 rubric 버전으로 새 배정·새 블라인드 파일 작업을 만든 뒤 이전 배정을 회수한다. 실패하면 전체가 롤백된다. 동일 actionId 재시도는 같은 결과를 반환한다.

## 블라인드 응답

심사 응답에는 blind code, category ID, ageGroup ID, 심사 상태와 배점만 포함한다. 참가자 이름·학교·연락처·보호자·결제·접수번호·원본 제목은 조회 SQL과 DTO에 포함하지 않는다. 다른 심사위원이나 미등록 계정은 배정 목록과 리뷰를 사용할 수 없다.

PDF 파일명만 바꾸어 원본을 제공하지 않는다. 배정 시 원본 `book_pdf`의 정확한 S3 VersionId를 고정한 변환 작업을 만들며, `POST /api/internal/storage/blind-reviews` 작업자가 문서 메타데이터와 문서 수준 부가 정보를 제외한 별도 PDF를 create-only 방식으로 저장한다. 자동 변환은 페이지에 보이는 이름·학교명까지 안전하게 판별할 수 없으므로 이 파일은 `pending_review` 상태에서 관리자에게만 보인다.

관리자는 `GET /api/v1/admin/competitions/{competitionId}/judge-assignments/{assignmentId}/blind-asset`의 60초 URL로 모든 페이지를 확인하고, `POST .../blind-asset/approve`에 후보 버전·SHA-256 체크섬·`confirmedNoVisibleIdentity: true`와 검수 메모를 보내야 한다. 승인 이력이 저장되고 `gyca_blinded_review_assets`에 정확한 버전이 등록된 뒤에만 심사위원에게 다운로드 URL이 발급된다. 준비되지 않았으면 `pdf=null`과 `BLINDED_FILE_NOT_READY`를 반환한다.

심사위원 계정은 `GET /api/v1/admin/judges`, `PUT /api/v1/admin/judges/{userId}`로 운영한다. 비활성화는 미제출 배정이 하나라도 있으면 `ENTRY_LOCKED`로 거부되며, 상태 변경 사유는 삭제·수정 불가 이력에 남는다.

작업자는 기본 비활성이다. `BLIND_REVIEW_WORKER_ENABLED=true`, 32자 이상의 `BLIND_REVIEW_JOB_TOKEN`, 별도 최소권한 S3 자격증명을 설정하고 스케줄러를 `GYCA_JOB_KIND=blind-reviews`로 실행한다. 이 자격증명에는 원본 정확 버전 읽기와 파생 객체 create-only 쓰기만 허용한다.

## 저장과 제출

임시저장과 제출은 모두 expectedRevision을 요구한다. 서버는 criterion ID와 최대 점수를 rubric에 맞춰 검사하고, 최종 제출은 모든 항목을 요구한다. 모든 revision의 점수·코멘트·상태·행위자·시각을 불변 이력에 저장한다. 제출 후 수정은 rubric에 명시적으로 허용된 경우에만 가능하며 수정하면 다시 제출해야 한다.

한 접수의 모든 배정이 제출되면 참가자용 reviewStatus는 completed, 일부가 진행 중이면 under_review가 된다. 심사 점수 자체는 참가자 결과가 아니며 공개 결과는 별도 관리자 확정 API를 거친다.

## 남은 작업

- 심사위원 초대 메일과 최초 비밀번호 설정 화면. 현재 등록 API는 기존 Better Auth 사용자만 활성화한다.
- Official Selection과 Finalist의 다단계 결과 라운드
- 실제 S3와 브라우저 PDF 열람 검증
