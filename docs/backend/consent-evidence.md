# 제출 당시 동의 이력 조회

GET `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/consents`

`@/contracts/consent-evidence`의 ConsentEvidenceSchema를 사용한다. 공통 `{data,meta}` 응답의 data는 entryId, submittedAt, consents다. consents는 참가 규정·개인정보·작품 이용허락 3종이며 각 항목에 kind, version, locale, title, text, textSha256, actorId, acceptedAt이 있다.

현재 공모 정책 대신 변경 불가능한 제출 스냅샷에서 읽는다. 동의 시각은 서버가 기록한 제출 시각이다. 해시는 당시 저장한 본문의 SHA-256이며 법적 효력이나 본인확인 완료 판정이 아니다. 원문은 HTML로 실행하지 않고 텍스트로 표시한다.

실제 gyca_competition_editors 권한이 필요하다. 결제 operator 권한만으로 조회할 수 없다. 비로그인 401, 권한 없음/회수 403, 다른 공모의 접수·없는 접수·아직 제출하지 않은 초안은 404, 잘못된 UUID는 422다. private,no-store. 제출 스냅샷의 참가자 프로필·보호자 이메일·파일 저장 키·요청 키는 반환하지 않는다. actorId는 동의 계정 증적이므로 관리자 화면에서만 취급한다.

보호자 동의는 기존 guardian-consents API로 별도 조회한다. 이 API는 보호자 확인이나 접수/결제 상태를 변경하지 않는다. 초안 404를 동의 거부로 표시하지 않는다. 기존 목록 allowedActions에는 새 액션을 추가하지 않았으며, 권한 있는 관리 화면이 제출된 접수에 이 조회를 연결할 수 있다.

2026-09-16 PGlite 검증: 정책 변경 후 원문 유지, 3종 분리, 권한/공모 범위/권한 회수, 초안과 없는 접수, 민감한 스냅샷 필드 비노출. 테스트 1개 및 전체 타입 검사·변경 파일 ESLint 통과. 운영 DB 적용·프런트 연결·법률 검토는 수행하지 않았다.
