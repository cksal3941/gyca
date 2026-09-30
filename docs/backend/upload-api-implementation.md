# 업로드 세션과 파일 검증 구현

## 구현한 것과 아직 연결하지 않은 것

업로드 세션 생성·파일 목록·완료 검증·참조 제거 API와 DB 상태 처리를 구현했다. PDF/이미지는 실제 바이트를 검증한다. 클로드의 화면·스타일·fixture는 변경하지 않았다.

실제 클라우드 저장소 어댑터는 미선정이다. runtime.ts에는 storage=null을 명시해 서명 URL 발급을 차단한다. DB 미설정이면 POLICY_NOT_CONFIGURED, 유효한 초안에서 저장소가 미설정이면 STORAGE_UNAVAILABLE이다. 새 환경변수 하나만으로 실업로드가 켜지는 구조가 아니다.

## API 계약

기본 경로 `/api/v1/entries/{id}/uploads`.

| 메서드·경로 | 입력 | 결과 |
| --- | --- | --- |
| GET 기본 경로 | 없음 | ApiSuccess<Page<Asset>>, 본인 파일만, nextCursor=null |
| POST 기본 경로 | UploadRequest, Idempotency-Key | ApiSuccess<UploadSession> |
| POST `/{assetId}/complete` | 빈 JSON 객체 `{}` | ApiSuccess<Asset> |
| DELETE `/{assetId}` | `{revision}` | ApiSuccess<{revision}> |

기존 세션 쿠키, 동일 출처 Origin, JSON 본문 및 no-store 정책을 따른다. 완료 요청에서 pageCount/state/storage key를 보내면 거부한다.

```json
{
  "revision": 1,
  "purpose": "book_pdf",
  "filename": "my-book.pdf",
  "sizeBytes": 123456,
  "mediaType": "application/pdf"
}
```

새 계약은 `@/contracts/uploads`에서 가져온다: UploadRequestSchema, UploadSessionSchema, UploadTargetSchema, RemoveUploadSchema 및 대응 타입.

세션 응답은 asset, revision, expiresAt, upload를 포함한다. upload는 method/url/headers/expiresAt이며 전송이 필요 없으면 null이다. sizeBytes는 서버가 아직 확인하지 않은 pending_upload 단계에서는 0이고 실제 검증 후 갱신한다. 요청 파일 크기는 프런트가 입력 자료로 별도 표시할 수 있으나 검증된 크기라고 표시하지 않는다.

## 프런트엔드 연결 순서

1. 본인 초안의 현재 revision으로 세션 생성. 같은 네트워크 요청 재시도에는 같은 멱등키와 원래 payload 사용.
2. 반환된 revision으로 초안 상태 갱신.
3. 저장소 전송 대상으로 원본 바이트를 전송.
4. complete에 `{}` 전송. 성공적인 저장소 응답만으로 ready를 표시하지 않음.
5. pending_upload/validating/ready/rejected 상태와 rejectionCode 표시. 동시 완료 요청은 validating 응답을 받을 수 있으므로 GET 목록으로 확인.
6. 삭제/교체는 현재 revision으로 DELETE 후 새 세션 생성. 삭제 응답의 revision 반영.

기존 초안 allowedActions에는 아직 upload를 추가하지 않았다. 실제 공급자 설정·전송 통합 검증 이후 서버에서 활성화한다. 현재 mock 화면은 계속 mock으로 취급한다.

## 저장소 어댑터 조건

src/server/uploads/storage.ts의 UploadStorage를 구현해야 한다.

- signCreate: 비공개 quarantine 객체에 대한 HTTPS 전송 대상 발급. 같은 키 덮어쓰기 금지(create-only). 선언 크기·형식 및 만료 제한 적용.
- readImmutable: 크기를 스트림으로 제한하고 특정 불변 버전의 바이트와 version 식별자를 반환. 객체가 없으면 null.
- 내부 키는 서버가 `quarantine/{entryId}/{assetId}`로 생성한다. 사용자 파일명을 저장소 경로로 사용하지 않는다.
- 검증한 version과 SHA-256을 DB에 기록한다. 추후 제출·다운로드도 그 버전을 사용해야 한다.
- 제거·만료·실패 객체의 실제 삭제는 보관 정책과 정리 작업으로 구현해야 한다. 지금 DELETE는 DB 참조를 soft-delete하며 원격 파일을 삭제하지 않는다.

PGlite 테스트에서는 가상 서명 대상과 메모리 객체 저장소를 주입했다. 클라우드 전송이나 IAM/CORS 정책이 검증됐다는 뜻은 아니다.

## 상태 및 동시성

- 초안 소유권·편집 가능 정책·revision·공모별 허용 용도/형식/파일 수를 검사한다.
- 세션 예약과 초안 revision 증가는 같은 트랜잭션에 있다. 같은 키와 다른 payload는 IDEMPOTENCY_CONFLICT.
- 저장소 서명 요청은 트랜잭션 밖에서 한다. 발급 실패 시 예약은 남아 있으며 같은 키로 다시 발급받을 수 있다.
- 세션 유효기간은 최대 15분이며 공모 마감보다 길지 않다. 만료 세션은 UPLOAD_EXPIRED로 안내한다. 이는 전송 URL의 기술 만료 시간으로, 참가자에게 결제나 접수 유예를 부여하지 않는다.
- 검증은 entry 행 잠금으로 claim 후 트랜잭션 밖에서 실행한다. 중복 완료 요청은 기존 상태를 반환하고, 2분 지난 검증 claim은 재시도할 수 있다.
- 검증 실패·작업자 오류는 pending_upload로 복구한다. 파일 자체 오류로 확인된 경우만 rejected가 된다.
- 검증 도중 제거된 파일은 최종화 시 다시 확인해 부활시키지 않는다.
- 현재는 완료 요청 안에서 검증을 실행한다. 자동 재시도 큐/주기적 복구 작업은 아직 없으며 실패 후 complete 재시도가 필요하다.
- 현 단계는 검사 완료 시점에도 초안 편집·기간 조건을 재확인한다. 마감 직전 전송 후 검증이 늦게 끝난 경우의 별도 인정 규칙은 운영 정책 결정과 후속 구현이 필요하다.

## 파일 검사 범위

- PDF: 헤더·종료 마커, pdf-lib 파싱, 암호화 거부, 페이지 수 및 최소 페이지 기준.
- PNG/JPEG: sharp로 형식 확인·실제 디코딩. 확장자만 믿지 않는다.
- 실제 크기가 요청한 크기와 다르면 ready로 처리하지 않는다.
- 워커 타임아웃 15초, JS 힙 한도 256MiB, 프로세스당 동시 검사 최대 2개.
- 현재 처리기의 기술 한도는 파일 64MiB, 이미지 4천만 픽셀, 출품당 누적 세션 128개다. 공모 maxBytes는 여전히 미확정이며 더 작은 공모 제한이 우선한다. 더 큰 파일 지원에는 처리 방식·용량 검토가 필요하다.
- ready는 이 단계의 형식·용량 검사를 통과했다는 뜻이다. 바이러스 검사, 모든 PDF 보안 검증, 심사 적격 여부를 보장하지 않는다. 악성 파일 검사 및 공개·다운로드 정책은 저장소 운영 구성에서 보완해야 한다.

## 오류 코드 추가

- STORAGE_UNAVAILABLE: 503, 저장소 미연결.
- UPLOAD_EXPIRED: 409, 전송 세션 만료.
- UPLOAD_LIMIT_REACHED: 409, 파일 개수 또는 세션 수 제한.

기존 FILE_NOT_READY는 저장소에 객체가 아직 없을 때, FILE_TOO_LARGE는 요청 크기 초과에 사용한다. 파일 검증 결과는 기존 rejectionCode 카탈로그를 따른다.

## 설치 및 배포

003_uploads.sql을 추가했고 기존 마이그레이션 실행기가 001~003을 순서대로 처리한다. 실DB에는 아직 적용하지 않았다.

```sh
node --env-file=.env.local scripts/migrate-entries.mjs
```

pdf-lib와 sharp를 직접 의존성에 추가했다. scripts/inspect-upload.mjs 및 관련 패키지를 완료 API의 standalone 파일 추적 대상에 추가했다. 공급자 연결 이후 실제 배포 이미지에서 워커 실행·native sharp 로딩도 검증해야 한다. 이번 단계에서는 배포하지 않았다.

## 검증

전체 계약·공모·접수·업로드 검사: 부모 테스트 포함 57개 통과. 타입 검사와 변경 파일 lint 통과.

실제 PDF 20쪽·20쪽 미만·손상·위장 파일, PNG 디코딩, 용량 초과, 본인 권한, 중복 예약, 파일 수 제한, 검증 오류 재시도, 검증 중 제거, 만료 세션을 확인했다. 실제 클라우드 전송 및 로그인 → 네트워크 PostgreSQL → 원격 저장소 전체 흐름은 아직 미검증이다.

```sh
node --experimental-strip-types --test tests/contracts.test.mjs tests/entries-api.test.mjs tests/competition-policy.test.mjs tests/competitions-api.test.mjs tests/upload-inspection.test.mjs tests/upload-service.test.mjs
```
