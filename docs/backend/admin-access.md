# 로그인 계정의 운영 권한 조회

GET `/api/v1/admin/access?limit=20&cursor=competition-id`

공통 `{data,meta}` 응답이며 `src/contracts/admin-access.ts`의 AdminAccessSchema를 사용한다.

```json
{"organizer":true,"paymentPermissions":[{"competitionId":"leipzig-2027","permission":"viewer"}],"nextCursor":null}
```

- organizer는 플랫폼 공모 운영 권한이다. 결제 권한을 자동 포함하지 않는다.
- paymentPermissions는 로그인 계정에 실제 부여된 공모별 viewer/operator 권한이다. organizer가 false여도 결제 권한은 있을 수 있다.
- limit 기본 20, 범위 1~50. competitionId 오름차순이며 다음 요청에 nextCursor를 전달한다. null이면 마지막 페이지다. 이후 페이지에서 organizer도 다시 조회한다.
- 로그인한 일반 참가자는 200, organizer=false, 빈 권한 목록이다. 비로그인은 401이다.
- 허용하지 않은 쿼리, 중복 쿼리, 빈/128자 초과 cursor, 범위 밖 limit는 422다. 다른 사용자 ID를 지정할 수 없다.
- fresh Better Auth 세션을 사용하고, 권한 두 종류를 단일 SQL 시점에 읽는다. 응답은 private,no-store다. 다른 사용자의 권한·이메일은 반환하지 않는다.

이 응답은 메뉴 구성용이다. 이후 권한 회수가 가능하므로 실제 작업 API는 매 요청마다 별도로 권한을 검사한다. 페이지 사이 권한 변경 시 목록은 달라질 수 있다. 프런트는 미조회 페이지를 권한 없음으로 확정하지 말고 nextCursor를 처리한다. 로그인/로그아웃 또는 403 이후 기존 권한 캐시를 재사용하지 않는다.

2026-09-16: PGlite에서 본인 범위, 일반 참가자, 비로그인, 페이지 이동, 입력 오류, 권한 회수, 공모 운영과 결제 권한 분리를 검증했다. 관련 테스트 파일 4개 및 전체 타입 검사, 변경 파일 ESLint 통과. 실제 호스팅의 인증 쿠키/DB 연결은 미검증이다. 권한 부여나 DB 마이그레이션은 수행하지 않았다.
