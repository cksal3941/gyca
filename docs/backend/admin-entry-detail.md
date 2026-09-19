# 관리자 접수 상세 API

구현일: 2026-09-19.

## 경로와 권한

`GET /api/v1/admin/competitions/{competitionId}/entries/{entryId}`

- 로그인과 실제 공모 운영자 권한이 필요하다.
- 권한이 없으면 `403`, 다른 공모의 접수이거나 존재하지 않으면 `404`다.
- 응답은 `private, no-store`이며 조회만 수행한다.
- 전송 계약은 `src/contracts/admin-entry-detail.ts`의 `AdminEntryDetailSchema`다.

## 응답 기준

목록 행의 필드에 아래 상세 정보가 추가된다.

- 참가자와 작품 전체 입력값
- 파일의 용도, 표시명, 미디어 형식, 크기, 페이지 수, 검사 상태와 거절 코드
- 보호자 확인 상태: `not_verified | pending_review | verified | expired | stale`
- 제출 당시 필수 동의 3종의 종류, 버전, 언어, 수락 시각
- 단계별 인증서 상태와 발급 시각
- 최근 운영 이력 최대 100건

제출 이력이 있으면 참가자·작품·연령 그룹·파일·동의는 현재 편집값이 아니라 제출 순간의 동결 스냅샷에서 읽는다. 초안만 현재 접수와 파일 값을 사용한다. 결제 성공과 `received`는 별개이며 접수번호와 접수 확정 시각은 `entryStatus=received`일 때만 제공한다.

`allowedActions`는 서버 판정값이다. 제출 이력이 있으면 `view_guardian_consents`, 현재 공개된 선정 단계의 인증서가 아직 없으면 `issue_certificate`가 포함될 수 있다. 화면에서 결과나 인증서 상태를 조합해 버튼을 새로 추론하지 않는다.

## 개인정보와 별도 증적

상세 응답에는 다음 값을 포함하지 않는다.

- PG 결제 키, 가맹점 ID, 공급자 내부 값
- S3 객체 키와 VersionId, 인증서 저장 경로
- 보호자 이메일, 토큰, 신원 확인 원문과 내부 증적 참조
- 동의문 전문

동의문 전문은 기존 `GET /api/v1/admin/competitions/{competitionId}/entries/{entryId}/consents`, 보호자 동의와 검증 자료는 기존 guardian-consents 경로를 `allowedActions`에 따라 별도로 조회한다. 파일 다운로드도 기존의 짧은 수명 서명 URL 경계를 사용한다.

## 감사 이력

다음 이벤트를 최신순으로 최대 100건 제공한다.

`entry.created`, `entry.submitted`, `payment.succeeded`, `entry.received`, `review.updated`, `result.published`, `final_participation.updated`, `certificate.queued`, `certificate.issued`, `certificate.retry_scheduled`, `certificate.stalled`.

이 목록은 운영 화면 요약용이다. 별도 페이지네이션이나 모든 원장 사건을 보장하는 감사 로그 내보내기는 아직 제공하지 않는다.

## 검증

PGlite 전체 마이그레이션 위에서 인증·권한·공모 범위 404, 제출 스냅샷 우선, 결제·보호자·심사·결과·인증서·감사 이력 집계, 민감 필드 비노출과 캐시 금지를 확인했다. 전체 서버 검증은 243개 테스트, 프로젝트 타입 검사, 서버 ESLint가 통과했다. 실제 PostgreSQL과 운영 데이터 규모에서의 쿼리 성능 및 브라우저 관리자 화면 연결은 아직 검증하지 않았다.
