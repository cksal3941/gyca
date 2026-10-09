# 회원 탈퇴·개인정보 삭제 요청 워크플로

2026-09-19. 사용자가 계정 폐쇄와 개인정보 삭제를 요청하고, 운영자가 보관 의무 충돌 여부를 검토할 수 있는 서버 워크플로다. 이 기능은 요청 접수와 판단 증적을 관리하며 실제 계정 삭제·익명화·파일 파기를 실행하지 않는다.

## 참가자 API

- `GET /api/v1/privacy/requests?limit=20&cursor=`
- `POST /api/v1/privacy/requests`
- `POST /api/v1/privacy/requests/{requestId}/cancel`

생성 본문은 `{actionId,kind:'account_closure_and_erasure'}`다. 한 계정에는 cancelled가 아닌 요청을 하나만 허용한다. 생성 결과 `submitted`일 때만 `allowedActions=['cancel_privacy_request']`이며, 운영 검토가 시작된 후에는 사용자가 임의로 철회할 수 없다.

취소 본문은 `{actionId,expectedRevision}`이다. 모든 쓰기는 로그인 세션과 동일 Origin을 요구한다. `actionId`는 UUID이고 같은 행위를 안전하게 재전송하는 멱등키다. 같은 actionId의 내용을 바꾸면 409다.

참가자 응답에는 계정 ID·이메일, 운영 증거 참조와 사유 코드를 포함하지 않는다.

## 관리자 API

- `GET /api/v1/admin/privacy-requests?state=&limit=20&cursor=`
- `POST /api/v1/admin/privacy-requests/{requestId}/review`

전역 운영자만 접근한다. 목록은 처리에 필요한 계정 ID·이메일과 마지막 전환 사유·내부 증거 참조만 제공한다. 참가자의 접수·결제·작품·보호자 데이터는 포함하지 않는다.

상태 전이는 서버 `allowedActions`로만 제공한다.

| 현재 상태 | 허용 작업 | 다음 상태 |
| --- | --- | --- |
| `submitted` | `start_review` | `under_review` |
| `under_review` | `place_retention_hold` | `retention_hold` |
| `under_review` | `approve_for_execution` | `approved_for_execution` |
| `retention_hold` | `resume_review` | `under_review` |

보관 보류 사유는 `LEGAL_RETENTION`, `PAYMENT_RECORD_RETENTION`, `CONTEST_EVIDENCE_RETENTION` 중 하나이며 내부 정책·사건 번호를 `evidenceReference`에 기록한다. 실행 승인에는 `NO_RETENTION_BLOCK`과 검토 기록 참조가 필요하다. 증거 참조에는 신분증·카드번호·비밀키 같은 원문 개인정보를 넣지 않는다.

## 중요한 경계

`approved_for_execution`은 삭제 완료가 아니다. 실제 삭제·익명화 작업자, 보관기간 만료 확인, 결제·동의 증적 분리, 세션 종료가 아직 구현되지 않았으므로 `completed` 상태와 완료 API를 제공하지 않는다. 화면에서도 “삭제 완료”로 표시하면 안 된다.

migration 035는 계정당 활성 요청 한 건, revision 증가, 상태 전환 증거, 행위 멱등 응답을 저장한다. 현재 상태는 같은 revision·상태의 전환 증적이 먼저 기록돼야 바뀌며, 전환과 action 기록은 UPDATE/DELETE할 수 없다.

## 검증 범위

PGlite에서 로그인·소유권·Origin·전역 운영자 권한, 엄격한 입력, 중복 활성 요청, 생성/취소/검토/보관 보류/재검토/실행 승인, revision 충돌, 멱등 재전송과 내용 변경 거부, 권한 회수, 변경 불가능한 전환 증적, 참가자 응답의 운영 정보 비노출을 검증했다. 실제 삭제·외부 파일 파기·메일 알림과 법률상 보관기간 판단은 검증 범위가 아니다.
