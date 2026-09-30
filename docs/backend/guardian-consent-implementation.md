# 보호자 이메일 동의 기록 — 비활성 서버 기반

2026-09-16. 이메일 링크 수락은 보호자 신원 확인이 아니다. 2026-09-18 운영자 수동 검증 API를 추가했다. 이메일 수락만으로는 계속 제출을 막으며, 권한 있는 운영자가 별도로 확인해야 한다.

## 운영자 수동 검증

POST `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/guardian-consents/{requestId}/verify`

본문은 `{entryRevision,evidenceReference}`다. `evidenceReference`는 운영자가 실제로 확인한 내부 상담·서류·본인확인 기록의 참조이며 신분증 번호나 원본 파일을 적는 필드가 아니다. API는 다음을 재검증한다.

- 실제 공모 운영자 권한과 동일 Origin
- 공모·접수·요청의 정확한 소속
- 보호자의 3종 동의 수락과 링크 유효기간
- 해당 접수의 최신 요청인지 여부
- 현재 접수 revision·동의 정책 토큰과 요청 당시 값의 일치

검증 기록은 migration 020의 변경 불가능한 감사 증적으로 보관된다. 같은 본문 재전송은 같은 결과를 반환하고 다른 참조나 revision은 409다. 검증 뒤에도 접수 내용이나 정책이 바뀌면 제출 readiness가 이전 확인을 인정하지 않는다.

관리자 증적 목록은 각 요청의 검증 시각과 증적 참조를 반환한다. 참가자 상태는 검증 전 `pending_review`, 검증 후 `verified`다. 이 구현은 외부 전자신원확인 서비스가 아니다. 운영자가 어떤 자료를 확인할지는 국가별 운영 정책으로 정해야 한다.

## API

공통 응답은 `{data,meta}`, 오류는 기존 오류 봉투이며 private,no-store다. 요청 스키마는 `src/contracts/guardian-consent.ts`에 있다.

| 경로 | 요청 | 동작 |
| --- | --- | --- |
| POST /api/v1/entries/{id}/guardian-consent | `{revision,locale:"en" 또는 "ko"}` | 로그인한 접수 소유자가 보호자 이메일로 요청 |
| GET /api/v1/entries/{id}/guardian-consent | 없음 | 소유자에게 최신 요청 상태 반환 |
| POST /api/v1/guardian-consent/preview | `{token}` | 링크 소지자에게 당시 3종 동의문과 만료 시각 반환 |
| POST /api/v1/guardian-consent/accept | `{token,guardianName,acceptedKinds}` | 3종 모두 수락한 기록 저장 |

acceptedKinds는 participation_rules, privacy, work_license를 각각 한 번씩 포함해야 한다. preview/accept는 회원 로그인이 필요 없지만, 강한 무작위 토큰과 동일 출처 Origin 검증을 요구한다. GET 링크 방문만으로 동의되지 않는다.

상태는 not_requested/pending/consented/expired/stale다. consented는 이메일 동의 기록만 존재한다는 의미이며 verificationStatus는 pending_review다. 만료·접수 수정·정책 변경 이후에는 최신 요청 상태가 expired/stale로 바뀌어도 기존 증적은 보존된다. 접수 완료 또는 보호자 확인 완료로 표시하지 않는다.

## 화면 연결

메일 링크는 `/guardian-consent#<token>`이다. 해당 페이지는 아직 미구현이다. 프런트는 fragment를 읽고 주소 표시에서 제거한 뒤 POST body로 전달한다. 토큰을 쿼리 문자열·분석 이벤트·로그에 넣지 않는다. 3종 문서를 별도로 보여주고 각각 명시적 동의를 받은 뒤 accept를 호출한다. 상태 조회는 참가자 소유 접수에만 허용된다.

서버는 24시간 만료, 재발송 시 이전 링크 무효화, 접수당 60초 간격·누적 10회 제한을 적용한다. 다른 접수 소유자와 알 수 없는 토큰은 404, 오래된 접수/정책은 409, 잘못된 동의 목록은 422, 발송 제한은 429다. 파일·접수 규격 등 다른 제출 차단 사유가 없어야 요청할 수 있다.

## 저장과 활성화 조건

마이그레이션 013은 요청 당시 접수 revision, 정책 토큰, 동의문, 수신 이메일, 토큰 해시, 만료 시각 및 수락자 이름·시각을 저장한다. 일반 UPDATE/DELETE를 차단한다. 보관·파기 운영 절차는 별도로 정해야 하며 무기한 보관 정책을 확정한 것은 아니다.

`GYCA_GUARDIAN_CONSENT_ENABLED=false`가 기본이다. 활성화에는 실제 DB 마이그레이션, HTTPS BETTER_AUTH_URL, 기존 Resend 메일 설정, 보호자 페이지, 운영 정책 검토가 필요하다. 지금은 실제 메일을 보내거나 설정을 켜지 않았다.

발송은 요청 저장 후 실행하며 별도 자동 재시도 작업은 없다. 발송 실패 시 저장된 요청을 성공 발송으로 표시하지 말고 재요청 제한을 안내한다. 참가자 화면의 pending은 전달 성공 증거가 아니다. 운영자 검토 절차는 실제 활성화 전에 보완해야 한다.

### 계정 단위 발송 제한 추가

접수별 60초 간격·누적 10회 제한에 더해, 동일 소유 계정의 모든 접수에서 최근 1시간 요청 합계를 최대 20건으로 제한한다. 초과 시 기존 RATE_LIMITED 429를 반환하고 요청 저장·메일 발송을 하지 않는다. 저장 후 메일 공급자가 실패한 요청도 합계에 포함한다. 시간 창에서 정확히 1시간 지난 요청은 제외되지만 접수별 누적 제한은 남는다.

계정별 DB 트랜잭션 잠금을 잡고 합계를 확인한 뒤 요청을 저장한다. 브라우저 탭이나 접수를 나눠도 동일 계정 합계를 사용한다. 계정별 제한이므로 여러 계정을 통한 남용 또는 수신 주소별 제한을 해결한 것은 아니다. 스테이징 운영에서 정상 요청량을 확인한 뒤 수치를 조정할 수 있다. 별도 DB 마이그레이션은 없다.

추가 검증: 19/20건 경계, 여러 접수 합산, 다른 계정 영향 없음, 1시간 경계, 제한 초과 시 실제 요청 서비스의 발송 차단. 기존 제출 테스트 포함 19개, 전체 타입 검사와 관련 ESLint 통과. PGlite 테스트이며 운영 PostgreSQL 동시 요청 부하 검증은 남아 있다.

## 검증

PGlite 제출 API 테스트 18개 통과. 보호자 흐름은 소유권, 3종 동의, 재수락 충돌, 증적 변경 차단, 재발송·수정·만료, 이메일 수락 후에도 제출 차단 유지 등을 검증했다. TypeScript 전체 검사와 관련 ESLint 통과. 실제 PostgreSQL 동시성·메일 전달·브라우저 동의 화면은 검증하지 않았다.

## 관리자 증적 조회 추가

GET `/api/v1/admin/competitions/{competitionId}/entries/{id}/guardian-consents?limit=20&cursor={requestId}`

기존 플랫폼 운영자 권한 `gyca_competition_editors`를 매 요청 확인한다. 이는 공모별 제한 권한이 아닌 전체 공모 운영자 권한이다. 일반 참가자·심사위원은 접근할 수 없다. URL의 공모전과 접수 소속이 다르면 404다. 발송 기능을 꺼도 보관된 증적은 조회할 수 있다.

응답 data의 공통 타입은 `src/contracts/guardian-admin.ts`의 GuardianEvidencePageSchema다. items에 requestId, entryRevision, locale, documents, createdAt, expiresAt, guardianName, acceptedAt을 반환한다. 미수락 요청의 이름·수락 시각은 null이다. 이메일 수신 주소, 토큰 및 토큰 해시는 반환하지 않는다. 과거 문서는 현재 동의문과 혼동하지 않도록 당시 revision과 시각을 함께 표시한다.

limit은 1~50, 기본 20이다. requestId 오름차순 커서 탐색이며 시간순 정렬이나 고정 스냅샷 조회가 아니다. nextCursor가 null이면 끝이다. 새 요청이 들어온 후 전체 최신 이력을 확인하려면 첫 페이지부터 다시 조회한다.

GET은 보관된 이력 조회이며 상태를 변경하지 않는다. 최신 수락 건이 검토 가능하면 `verify_guardian`을 안내하지만 POST가 revision·정책·최신 요청을 다시 검사한다. 참가자 API의 `pending_review`는 승인 대기, `verified`만 현재 정책과 revision이 일치할 때 제출 판단에 사용된다. 만료·과거 요청 기록도 감사 이력으로 남는다.

추가 검증: 비로그인 401, 일반 사용자·권한 회수 후 403, 공모/접수 불일치 404, 페이지 입력 422, 빈 목록·페이지 이동·민감 필드 비노출·no-store·조회 후 draft 유지. 제출 테스트와 함께 총 19개 통과. 실제 관리자 화면과 운영 DB 검증은 남아 있다.
