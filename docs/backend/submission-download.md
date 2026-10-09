# 제출 파일 다운로드

POST `/api/v1/entries/{entryId}/submission/assets/{assetId}/download`

본문 없이 동일 출처 Origin과 로그인 세션을 보낸다. 응답 `{data,meta}`의 data는 `@/contracts/submission-download`의 SubmissionDownloadSchema: `{url,expiresAt}`다. 제출 기록 assets의 id를 사용한다. 초안 파일 다운로드는 지원하지 않는다.

서버는 접수 소유권과 제출 스냅샷에 포함된 ready 파일을 확인하고, 저장된 object_version에만 서명한다. 현재/latest 파일로 대체하지 않는다. 실제 S3 설정이 있어야 하며 버전 관리와 공개 접근 차단을 검사한다. URL 유효 시간은 60초다. 첨부 다운로드와 application/octet-stream, private,no-store를 서명에 포함한다. 기본 파일명은 submission-file이다.

비로그인 401, 잘못된 Origin 403, 타인/미제출/없는 접수 또는 스냅샷에 없는 파일 404, 잘못된 UUID 422, 미검증 파일 409, 저장소 미설정/오류 503. API 응답도 private,no-store다. 사용자 제공 키·버전·URL은 받지 않는다.

서명 URL은 임시 접근 자격이며 버킷 경로와 버전이 URL에 포함된다. 분석 이벤트·로그·로컬 저장소에 저장하지 않고 다운로드에만 사용한다. 이미 발급한 URL은 로그아웃해도 만료 전 사용 가능하며 일회용 토큰은 아니다. URL 발급은 객체 존재나 전송 성공의 증명이 아니다. 만료되면 다시 발급하고, S3의 실제 전송 오류를 별도로 표시한다. 서버는 파일 본문을 중계하지 않는다.

운영 S3 권한에는 GetObjectVersion이 필요하다. 기존 버킷 점검 권한도 유지한다. 실제 권한·버킷 변경은 수행하지 않았다. 2026-09-16 PGlite 권한 테스트 및 실제 AWS SDK 서명 테스트 포함 10개, 전체 타입 검사·변경 범위 ESLint 통과. 실제 AWS 전송·브라우저 다운로드는 미검증이다.
