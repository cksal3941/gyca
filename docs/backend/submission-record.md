# 참가자 제출 기록 조회

GET `/api/v1/entries/{entryId}/submission`

`@/contracts/submission-record`의 SubmissionRecordSchema와 기존 `{data,meta}` 응답을 사용한다. 본인 소유의 저장된 제출 스냅샷을 읽어 entryId, competitionId, submittedAt, participant, work, ageGroup, assets, consents를 반환한다. 파일 목록은 id/purpose/displayName/mediaType/sizeBytes/pageCount이며, 동의는 제출 당시 원문·버전·본문 해시·actorId·acceptedAt이다.

view_submission 동작의 조회 경로다. 현재 공모 요강이나 정책으로 당시 내용을 다시 구성하지 않는다. 결제 후 상태가 변해도 저장된 제출 기록은 동일하다. 이 응답에는 현재 entryStatus/receiptNumber/payment가 없으므로 접수 확정 여부는 기존 접수·결제 조회 API로 판단한다. 제출 기록 존재만으로 결제 성공·received를 표시하지 않는다.

로그인 필수(401). 다른 계정의 접수·없는 접수·미제출 초안은 모두 404이며 잘못된 UUID는 422다. 관리자라도 이 참가자 경로에서 다른 계정의 기록을 볼 수 없다. fresh 인증 세션과 private,no-store를 사용한다.

보호자 연락처, 공모 내부 정책, 파일 저장 키/버전/서명 URL, 요청 키/해시는 반환하지 않는다. 파일 정보는 목록 확인용이며 다운로드 권한이나 URL이 아니다. 원문 동의와 사용자 입력은 텍스트로 표시한다.

2026-09-16 PGlite 테스트에서 현재 데이터와 다른 과거 스냅샷 반환, 소유권 차단, 초안/없는 ID/잘못된 ID, 비공개 필드 비노출, 기존 관리자 동의 조회 회귀를 검증했다. 테스트 및 전체 타입 검사·변경 파일 ESLint 통과. 실제 브라우저/운영 DB 연동은 미검증이며 프런트는 수정하지 않았다.
