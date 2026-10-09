# AWS S3 파일 저장 연결

2026-09-16. 공식 AWS SDK client-s3 및 s3-request-presigner 3.1131.0을 추가하고 기존 UploadStorage 인터페이스를 구현했다. UI·mock·동의 정책은 변경하지 않았다.

## 동작

- `GYCA_STORAGE_PROVIDER=aws-s3`와 필수 설정이 있어야 활성화한다. 기본 disabled. 자격 증명을 자동으로 로컬 AWS 프로필에서 추측하지 않는다.
- signCreate와 readImmutable에서 버킷 소유 계정, Versioning Enabled, 네 가지 PublicAccessBlock=true를 확인한다. 요청 제한시간 내 확인에 실패하면 STORAGE_UNAVAILABLE이다.
- quarantine의 서버 생성 키에만 URL을 발급한다. SDK SigV4에 파일 크기·Content-Type·If-None-Match 및 소유 계정 헤더를 포함한다. 서명은 최대 15분이며 접수 마감 전에 설정된 세션 유효기간을 넘지 않는다.
- `If-None-Match: *`를 제거하면 서명이 맞지 않으며 기존 객체는 덮어쓸 수 없다. [AWS 조건부 PUT](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html).
- GetObject 응답의 동일 파일 바이트와 VersionId를 함께 사용한다. 버전이 없거나 null이면 거부한다. 별도 HEAD 후 최신 객체를 읽는 방식이 아니다. [AWS GetObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_GetObject.html).
- 보고된 ContentLength와 실제 스트림 크기를 검사하고 최대 64MiB까지 읽는다. 이후 기존 PDF/이미지 검사와 제출 증적에 버전을 연결한다. 스트림은 성공·실패 시 닫는다.
- NoSuchKey는 아직 업로드되지 않은 파일로 처리하고 권한·통신 오류는 정보 노출 없이 503 처리한다. 자동 객체 삭제나 공개 다운로드는 추가하지 않았다.
- 보관 작업자는 앱 업로드 자격 증명과 분리된 `GYCA_S3_RETENTION_*` 자격 증명을 사용한다. 정책으로 예약된 정확한 VersionId에만 DeleteObject를 보내며 키의 현재 버전이나 버킷 전체를 삭제하지 않는다.

## 계정 준비 후 필요한 설정

`.env.example`의 GYCA_S3_REGION, BUCKET, ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY를 채운다. 임시 자격 증명은 SESSION_TOKEN도 함께 설정한다. 키는 채팅·저장소·프런트 환경변수에 넣지 않는다.

전용 비공개 테스트 버킷에서 Versioning과 Public Access Block 네 항목을 활성화한다. 앱 서버 자격 증명에는 버킷 설정 조회(`s3:GetBucketVersioning`, `s3:GetBucketPublicAccessBlock`)와 quarantine 접두사 한정 PutObject/GetObject/GetObjectVersion 권한이 필요하다. 키 삭제·버킷 설정 변경 권한은 앱 자격 증명에 주지 않는다. 별도 보관 작업자 자격 증명에만 설정 조회와 quarantine 접두사 버전 삭제 권한을 부여한다. 실제 IAM 정책과 AWS 계정 상태에서 권한 검증은 남아 있다.

CORS는 실제 프런트 origin만 허용하고 PUT, Content-Type, If-None-Match, x-amz-expected-bucket-owner 요청 헤더를 허용한다. 개발 localhost와 운영 origin을 구분한다. 클라이언트는 파일 원본을 PUT하고 서버의 headers를 전달한다. 브라우저가 자동으로 보내는 Content-Length는 파일 크기와 같아야 한다. AWS 계정 ID는 서명된 업로드 헤더에 포함되는 비밀이 아닌 식별자다.

버전 파일을 덮어쓰는 주체나 별도 관리자 작업은 이 어댑터 밖에 있을 수 있으므로 서버 권한을 최소화하고 버킷 정책에도 조건부 쓰기를 적용할 수 있다. [AWS 버킷 정책으로 조건부 쓰기 강제](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes-enforce.html). 수명주기 삭제는 아직 켜지 않는다. 미입상작·증적 보존기간과 모든 버전 삭제 정책을 먼저 정해야 한다.

## 검증과 제한

관련 25개 테스트 통과: 실제 AWS SDK 서명 생성, 설정 차단, 서명 헤더, 크기·버전 검증, 오류 비노출 및 기존 업로드·파일 검사. S3 응답은 SDK 테스트 middleware로 대체했다. 실제 AWS나 브라우저 CORS를 검증한 것은 아니다. 타입 검사·ESLint도 통과했다.

현재 최대 64MiB 단일 PUT만 지원한다. 다중 부분 업로드·중단 재개, 악성코드 검사와 운영 다운로드는 미구현이다. 파기 실행은 철회된 미제출 초안과 최종 공개 결과의 미입상·선정 파일에 연결되어 있다. 서명 URL은 유효기간 내 권한을 가진 URL이므로 로깅하지 않는다. 조건부 쓰기 충돌 후에는 기존 complete 경로로 실제 저장 파일을 검사한다.

계정 생성·유료 신청·버킷 생성·실배포는 하지 않았다. 이후 전용 테스트 버킷에서 실제 로그인→업로드→검사→제출을 검증해야 한다.
