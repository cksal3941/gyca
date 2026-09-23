# 인증서 발급·조회·다운로드

2026-09-19. 결과 공개 이력에 근거한 Official Selection/Finalist 인증서를 migration 029에 추가했다. 공개 결과가 없는 접수에는 인증서를 예약할 수 없다.

## API

- POST `/api/v1/admin/competitions/{competitionId}/certificates/issue`
  - `{entryIds,stage,actionId}`. 한 번에 1~100건이며 공모 운영 권한과 동일 출처 요청이 필요하다.
  - 응답 상태는 `pending|issued|stalled`이다. 202 응답은 PDF 생성 완료가 아니라 내구성 있는 작업 예약이다.
- GET `/api/v1/certificates?cursor&limit`
  - 로그인한 참가자의 발급 완료 인증서만 페이지로 반환한다.
- GET `/api/v1/entries/{entryId}/certificates?cursor&limit`
  - 본인 접수의 발급 완료 인증서만 반환한다.
- POST `/api/v1/certificates/{certificateId}/download`
  - 빈 JSON `{}`. 본인 발급 완료 인증서에만 정확한 S3 VersionId 기반 60초 링크를 반환한다.

Official Selection은 첫 결과 라운드에서 `official_selection`으로 공개된 접수만, Finalist는 두 번째 라운드에서 `finalist`로 공개된 접수만 대상이다. 동일 entry/stage는 한 장만 생성하며 actionId 재전송은 같은 발급 묶음을 조회한다.

## 작업자와 저장소

관리자 요청은 동결된 영문 참가자명·영문 작품명·공모명·선정 단계·발급 번호를 저장한다. 작업자는 이 스냅샷으로 PDF를 만들고 create-only S3 쓰기를 수행한다. 응답 유실 시 저장된 바이트의 SHA-256이 정확히 일치할 때만 성공으로 복구한다. DB에는 객체 key와 VersionId, 체크섬을 저장하며 상시 공개 URL은 저장하거나 응답하지 않는다.

`CERTIFICATE_WORKER_ENABLED=true`, 32자 이상의 `CERTIFICATE_JOB_TOKEN`, private/versioned S3를 설정하고 `GYCA_JOB_KIND=certificates`로 작업자를 실행한다. 최대 8회 지수 백오프 뒤 stalled가 된다. 발급 완료 뒤에만 Entry의 `download_certificate` 액션과 참가자 인증서 목록이 열린다.

현재 PDF는 승인 전 최소 영문 서식이다. 공식 로고·서명·문구가 승인되기 전에는 작업자를 활성화하지 않는다. 참가자 영문명, 영문 작품명 또는 영문 공모명이 없거나 PDF 기본 글꼴로 표현할 수 없으면 발급 요청을 거부한다. 실제 S3·스케줄러·인쇄 결과는 아직 검증하지 않았다.
