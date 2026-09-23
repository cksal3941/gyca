# S3 읽기 전용 사전 점검

외부 S3 설정 후 저장소의 필수 버킷 보호 설정과 접근 가능 여부를 점검한다.

```powershell
node --experimental-strip-types scripts/storage-check.mjs
```

환경변수는 기존 S3 런타임과 같다: GYCA_STORAGE_PROVIDER=aws-s3, GYCA_S3_REGION/BUCKET/ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY, 필요 시 SESSION_TOKEN. 비밀 값은 실행 환경에 주입하고 명령 인자나 문서에 넣지 않는다. 로컬 환경 파일을 사용하는 경우 Node의 --env-file 옵션으로 명시적으로 로드한다. 이 도구는 파일을 자동으로 찾아 읽지 않는다.

GetBucketVersioning과 GetPublicAccessBlock만 호출한다. ExpectedBucketOwner를 지정하며 버전 관리 Enabled와 네 가지 공개 접근 차단 플래그를 모두 요구한다. 요청 제한 시간은 10초, AWS 클라이언트 재시도는 기존 설정대로 1회 시도다. 오류 상세/버킷 이름/인증 정보는 출력하지 않는다. 설정 누락·잘못된 인자·AWS 오류·조건 불충족은 종료 코드 1, 통과는 0이다.

이는 버킷 설정 확인이다. 객체 GetObjectVersion/PutObject 권한, 브라우저 CORS, 암호화, 수명주기, 실제 파일 전송은 별도로 검증한다. 점검 성공만으로 launch-readiness나 접수 플래그를 활성화하지 않는다. 업로드/다운로드/삭제/버킷 변경을 수행하지 않는다.

전체 소스가 있는 로컬 또는 Docker migration 단계 환경에서 실행한다. 최소 runner 이미지에는 이 스크립트를 추가하지 않았다.

검증: S3 어댑터와 CLI 테스트 총 11개, 프로젝트 타입 검사, 변경 파일 ESLint 통과. 가짜 AWS 응답으로 버전 관리/공개 차단 실패 및 비밀 정보 비노출을 확인했고 기존 서명/읽기 테스트도 통과했다. 실제 AWS 계정에 대한 점검은 아직 실행하지 않았다.
