# 공모별 결제 운영 권한

2026-09-16. 기존 결제 예외 검토 API의 권한을 운영자가 관리하는 CLI다. 실제 권한 부여·회수나 운영 DB 마이그레이션은 실행하지 않았다.

## 권한 범위

- viewer: 해당 공모의 결제 예외 검토 목록과 처리 이력 조회.
- operator: viewer 범위에 더해 서버가 허용한 중단 복구 작업 재개.
- 추가된 결제 정책 API에서는 viewer가 설정 조회, operator가 접수 시작 전 정책 수정도 수행한다. [설정 API](payment-policy-admin.md)를 참고한다.
- null: 해당 공모의 결제 권한 회수.

operator도 결제를 임의 성공 처리하거나 접수번호를 발급할 수 없다. 전체 공모 운영자 권한과 별개이며 한 공모의 권한 변경은 다른 공모에 전파되지 않는다. 기본 권한은 없다.

## 실행

마이그레이션 015까지 적용하고, 확인된 실제 사용자 ID·이메일·공모 ID로 요청 파일을 준비한다. 파일은 Git 밖 기관 관리 경로에 보관한다.

```json
{
  "userId": "실제 사용자 ID",
  "expectedEmail": "finance@example.org",
  "competitionId": "실제 공모 ID",
  "expectedPermission": null,
  "permission": "viewer",
  "reason": "공모 결제 예외 조회 담당자 지정",
  "operatorReference": "기관 내부 승인 기록 번호"
}
```

```powershell
node --env-file=.env.local scripts/manage-payment-access.mjs C:/secure/payment-access.json
node --env-file=.env.local scripts/manage-payment-access.mjs C:/secure/payment-access.json --apply
```

기본 명령은 미리보기 후 롤백하며 --apply만 변경한다. viewer에서 operator로 바꾸려면 expectedPermission=viewer, permission=operator를 지정한다. 회수는 permission=null이다. 계정 ID·이메일이 정확히 일치해야 하고, 부여·변경에는 이메일 확인 완료가 필요하다. 회수는 이메일 미확인 상태에서도 가능하다. 공모가 없거나 예상 현재 권한이 다르면 중단한다.

## 감사·운영 제한

권한 변경과 감사 행은 하나의 트랜잭션으로 저장된다. 감사에는 대상 ID·공모 ID·이전/새 권한·사유·기관 참조·실행 DB 역할·시각을 남긴다. 일반 UPDATE/DELETE는 차단한다. operatorReference는 입력자가 제공한 기록 참조이며 사용자 신원 인증값이 아니다. 실행은 DB 자격증명을 보유한 인프라 운영자에게만 제한한다. 직접 SQL로 변경한 권한은 이 도구의 감사에 자동 기록되지 않는다.

진행 중인 관리자 요청의 공유 잠금이 끝나면 권한 변경이 적용되고, 변경 후 새로운 요청부터 현재 권한을 따른다. 요청 파일은 최대 8KiB다. 실패하면 종료 코드 1이며 내부 DB 오류나 이메일·연결 문자열을 로그에 출력하지 않는다. COMMIT 응답 중단 등으로 결과가 불명확하면 현재 권한과 감사 기록을 먼저 확인한다. 자동 재시도하지 않는다.

공개 웹 API나 권한 관리 UI는 추가하지 않았다. migration 이미지에는 스크립트가 포함되며 웹 runner에는 없다.

## 검증

PGlite에서 미리보기, 계정/공모/입력 검증, 예상 상태 충돌, 권한 상승·회수, 공모 격리, 전체 운영자 권한 비변경, 감사 불변성·실패 롤백을 확인했다. 기존 결제 관리자·운영자 도구·DB 점검과 함께 테스트 13개 및 관련 ESLint 통과. 실제 운영 DB 동시성 검증은 남아 있다.
