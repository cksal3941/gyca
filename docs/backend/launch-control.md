# 접수·결제 최초 오픈 경계

2026-09-19. 공모 등록·공개와 실제 접수/결제 활성화를 분리한다. `published=true`만으로 Apply나 결제를 열지 않는다.

## 준비 조회

`GET /api/v1/admin/competitions/{competitionId}/launch-readiness`

기존 13개 점검을 반환한다. DB 정책·일정·폼·동의·보호자 기준·결제 경로 외에 아래 세 항목은 현재 공모 revision에 묶인 유효한 운영 증거가 필요하다.

- `storage`: private/versioned 저장소와 실제 전송 점검
- `retention`: 정확한 객체 버전 파기 작업과 스케줄 점검
- `live_payment_verification`: 운영 가맹점의 결제·조회·취소 경로 점검

모든 항목이 configured이고 draft/payment가 아직 비활성일 때만 `canOpen=true`, `allowedActions=['open_applications']`다. 테스트 모드 결제 경로는 live_payment_verification을 충족하지 않는다.

## 운영 증거 등록

`POST /api/v1/admin/competitions/{competitionId}/launch-verifications`

```json
{
  "actionId": "uuid",
  "expectedRevision": 1,
  "code": "storage",
  "evidenceReference": "internal-check-reference",
  "validUntil": "2026-09-20T00:00:00Z"
}
```

전체 공모 운영자만 등록한다. 증거 유효기간은 서버 현재 시각에서 최소 5분, 최대 30일이다. 비밀 키·카드 정보·원문 로그를 evidenceReference에 넣지 않고 내부 점검 기록 식별자만 저장한다. 기록은 수정·삭제할 수 없다. 공모 정책 변경으로 revision이 바뀌면 이전 증거는 자동으로 준비 판정에서 제외된다.

## 접수·결제 오픈

`POST /api/v1/admin/competitions/{competitionId}/open-applications`

```json
{"actionId":"uuid","expectedRevision":1,"reason":"승인 회의 기록"}
```

서버는 직전 readiness, 현재 revision, 미활성 상태, 마감 전 여부와 세 운영 증거의 유효기간을 다시 확인한다. 통과하면 `draft_enabled=true`, `payment_enabled=true`, revision 증가와 불변 감사 기록을 한 트랜잭션으로 저장한다. 둘 중 하나만 켜진 상태는 만들지 않는다.

동일 actionId와 동일 요청은 결과를 재생한다. 내용을 바꾸면 409다. 실패 시 활성 플래그나 감사 기록 일부만 남지 않는다. 오픈 후 긴급 중단·재개는 기존 pause/resume API를 사용한다.

현재 저장소·운영 PG 계정과 실검증 증거가 없으므로 배포 환경의 `canOpen`은 계속 false다. 이 API 추가가 실제 접수를 활성화하지 않는다.
