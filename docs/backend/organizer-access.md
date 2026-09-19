# 공모 운영자 권한 관리 도구

2026-09-16. 기관 담당자의 실제 Better Auth 계정에 전체 공모 운영자 권한을 부여·회수하는 인프라 운영용 CLI다. 이번에는 도구와 마이그레이션만 추가했으며 실제 권한은 변경하지 않았다. 공개 웹 API나 자기 권한 승격 기능은 없다.

## 요청과 실행

먼저 마이그레이션 014까지 적용한다. 담당자가 확인한 사용자 ID와 정확한 이메일을 아래 JSON에 넣는다. 요청 파일은 저장소 밖의 기관 관리 위치에 보관하고 공유 채팅이나 Git에 넣지 않는다.

```json
{
  "userId": "실제 사용자 ID",
  "expectedEmail": "담당자 이메일",
  "expectedGranted": false,
  "grant": true,
  "reason": "기관 운영 담당자 지정",
  "operatorReference": "기관 내부 승인 기록 번호"
}
```

```powershell
node --env-file=.env.local scripts/manage-organizer.mjs C:/secure/organizer-request.json
node --env-file=.env.local scripts/manage-organizer.mjs C:/secure/organizer-request.json --apply
```

첫 명령은 대상 계정과 현재 권한을 대조해 결과만 출력하고 트랜잭션을 롤백한다. --apply를 붙인 명령만 실제 변경한다. 회수는 grant=false, expectedGranted=true로 작성한다. 권한 부여에는 이메일 확인 완료가 필요하며, 회수는 이메일 확인 상태와 무관하게 가능하다. 사용자 ID와 이메일 불일치, 예상 권한 불일치 시 중단한다. 회수 후 이미 진행 중인 요청이 끝날 수 있지만 새 관리자 요청은 권한 검사를 통과하지 못한다.

## 범위와 감사

gyca_competition_editors는 전체 공모 운영 권한이다. 공모별 결제 viewer/operator 권한은 별도로 유지하며 이 도구가 추가하지 않는다. 권한 변경과 감사 행 저장은 같은 트랜잭션이다. 감사 기록에는 대상 ID, 이전·새 권한, 사유, 운영 참조, DB 역할, 시각이 남고 일반 UPDATE/DELETE를 차단한다. 사유에는 불필요한 개인정보를 넣지 않는다.

operatorReference는 입력자가 제공하는 기관 내부 참조이며 신원 인증값이 아니다. 실행 권한은 서버의 DB 자격증명 접근 통제로 제한해야 한다. 다른 도구나 직접 SQL로 변경한 권한은 이 감사 테이블에 자동 기록되지 않는다. DB 관리자 자체를 차단하는 보안 경계도 아니다.

실패 시 종료 코드 1을 반환하고 내부 DB 오류·연결 문자열을 출력하지 않는다. COMMIT 응답이 끊기는 등 성공 여부가 불명확하면 현재 권한과 감사 기록을 확인한 뒤 재시도한다. 자동 재시도하지 않는다. 요청 파일은 최대 8KiB다. migration 이미지에는 스크립트가 포함되지만 공개 웹 runner에는 추가하지 않는다.

## 검증

PGlite 테스트에서 미확인/불일치/없는 계정 거부, 미리보기 무변경, 부여·회수, 예상 권한 충돌, 감사 불변성, 감사 실패 시 권한 롤백, 결제 권한 비변경을 확인했다. DB 점검 회귀 테스트와 함께 2개 통과, 관련 ESLint 통과. 운영 DB·실제 계정·동시 운영 명령은 검증하지 않았다.
