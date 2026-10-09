# 테스트 배포 실행 절차

2026-09-16. 계정 생성·유료 신청·실제 DB 마이그레이션·배포는 아직 실행하지 않았다.

## 이번 변경

- Docker Node 런타임을 로컬 검증 환경과 같은 24 계열로 변경.
- standalone 이미지에 public과 파일 검사 스크립트, 배포 점검 스크립트 복사. 이미지/폰트 등 public 자산 누락 수정.
- 로컬 패키지 캐시와 에이전트 설정 디렉터리를 Docker 빌드 컨텍스트에서 제외.
- `scripts/migrate-all.mjs`: 인증 스키마부터 플랫폼 마이그레이션까지 순차 실행, 앞 단계 실패 시 중지.
- 인증 마이그레이션도 DATABASE_URL 누락 시 연결을 시도하지 않고 실패. 연결 오류 상세 대신 일반 오류 출력, 풀 종료.
- Docker `migration` target 분리. 웹 시작 시 마이그레이션을 자동 실행하지 않는다.

## 1. 로컬 설정 검사

계정 준비 후 비밀 설정은 git에 포함되지 않는 .env.local에 저장한다. 공유 채팅에 붙이지 않는다.

```powershell
node --env-file=.env.local scripts/deployment-check.mjs
```

Node 버전, DB URL 형식, 인증 secret 길이, HTTPS 공개 origin, public/검사 파일, pg/pdf-lib/sharp 로딩을 검사한다. 값은 출력하지 않고 PASS/MISSING만 출력한다. 네트워크 요청이나 상태 변경은 없다. 운영 점검이라 localhost HTTP 주소는 실패한다.

**이 명령 통과는 DB 연결·S3/PG 설정·마이그레이션 완료·실접수 가능을 의미하지 않는다.** 별도 실제 연결 검증이 필요하다.

## 2. 스키마 초기화

인증과 플랫폼 스키마는 담당자 한 명이 테스트 DB에 명시적으로 실행한다. 기존 DB라면 백업·복원 절차를 먼저 확인한다.

```powershell
node --env-file=.env.local scripts/migrate-all.mjs
```

인증 마이그레이션과 플랫폼 마이그레이션은 하나의 원자적 트랜잭션이 아니다. 플랫폼 단계가 실패해도 앞서 적용된 인증 스키마는 남을 수 있다. 원인을 수정 후 재실행한다. 기존 플랫폼 체크섬·잠금 검증은 유지한다. 기본 공모전이나 관리자 계정을 자동 생성하지 않는다.

## 3. Docker 이미지

### 마이그레이션 후 읽기 전용 DB 점검

```powershell
node --env-file=.env.local scripts/database-check.mjs
```

실제 DB에 접속해 플랫폼 테이블 존재, 공통 마이그레이션 목록의 체크섬/건수 일치, 인증용 주요 컬럼 존재를 확인한다. 연결 대기는 5초, SQL 실행 제한은 5초이며 읽기 전용 트랜잭션을 사용하고 끝나면 ROLLBACK한다. 연결 문자열·사용자 데이터는 출력하지 않는다. 실패하면 종료 코드 1을 반환한다. 누락을 발견해도 자동으로 마이그레이션하거나 권한을 부여하지 않는다.

이 검사는 전체 스키마의 타입·인덱스·트리거·제약조건 동등성을 검증하지 않는다. DB 연결·조회 권한을 확인할 뿐 쓰기 권한, 백업 복원, PG·S3·메일과 실제 오픈 가능 여부는 확인하지 않는다. 현재 런타임이 준비하는 rateLimit 테이블의 주요 컬럼도 검사한다.

컨테이너에서 실행하려면 아래 migration 이미지를 만든 뒤 `docker run --rm --env-file .env.local gyca-migration node scripts/database-check.mjs`로 기본 명령을 덮어쓴다. 공개 웹 runner 이미지에는 SQL 마이그레이션 파일과 이 점검 도구를 추가하지 않았다.

점검 테스트는 PGlite에서 빈 DB·체크섬 불일치·테이블/인증 컬럼 누락·읽기 전용 트랜잭션의 쓰기 거부를 확인했다. 배포 스크립트 테스트를 포함해 3개와 관련 ESLint 통과. 실제 운영 PostgreSQL에는 아직 연결하지 않았다.

Docker가 설치된 개발/CI 환경에서 실행한다.

```sh
docker build --target runner -t gyca-web .
docker build --target migration -t gyca-migration .
docker run --rm --env-file .env.local gyca-migration
docker run --rm --env-file .env.local -p 8080:8080 gyca-web
```

migration 이미지는 DB 초기화 스크립트와 전체 빌드 디렉터리를 포함하는 별도 작업용이다. 공개 웹 서비스는 runner 이미지를 사용한다. Docker 빌드 중에는 DB 초기화나 실제 키가 필요하지 않다. 현재 Google Fonts를 빌드 시 내려받으므로 빌드 네트워크에서 접근 가능해야 한다.

## 4. 실제 연결 확인 순서

결제 복구·접수 이메일 예약 실행은 [스케줄러 실행 도구](scheduled-jobs.md)를 사용한다. 웹과 별도 프로세스에서 `node scripts/run-scheduled-jobs.mjs`를 실행하며, 작업 종류별 토큰을 환경변수로 제공한다. 실제 스케줄 등록은 아직 하지 않았다.

1. 테스트 URL의 정적 이미지·홈 확인.
2. 실제 회원가입·이메일 확인·로그인 후 [운영자 권한 도구](organizer-access.md)로 주최 측 계정 대조 및 권한 부여.
3. 공모 비공개 등록, 공개 조회, 동의문·기간·파일/결제 정책 설정.
4. S3 실제 브라우저 PUT 및 complete 파일 검사 확인.
5. PG 테스트 결제·지연 통지·접수번호·환불 검증.
6. 백업 복원·실패 복구·마감 부하 검증 후 운영 오픈 판단.

현재 보호자 확인·실제 결제창·파기 등 미완료 기능은 launch-readiness에 남는다. 스크립트 실행만으로 이를 해제하지 않는다.

## 검증 범위

배포 스크립트 테스트 2개와 ESLint 통과. DB 누락 시 인증/전체 초기화 중단, 점검 결과의 비밀값 비노출, 잘못된 origin/secret 차단 확인. 실제 DB 없이 수행했다. Docker 실행 파일이 없어 컨테이너 빌드·실행은 검증하지 못했다. 프로덕션 Next 빌드는 별도 결과를 아래에 기록한다.

### 프로덕션 빌드 결과

`pnpm build --webpack` 완료: 컴파일, TypeScript, 페이지 생성 및 standalone 출력까지 성공했다. 인증 키·URL이 없는 환경이라 Better Auth 경고는 발생했다. 이는 운영 설정을 대신하지 않는다.

기본 Turbopack 빌드는 Windows pnpm 경로의 `@pdf-lib/standard-fonts` 하위 pako 링크 읽기에서 OS error 5로 실패했다. Linux Docker의 동일 실패 여부는 확인하지 않았다. 이번에 검증한 빌드 명령은 Webpack이며, Docker 빌드도 이 명령을 사용하도록 맞췄다. 개발 모드와 화면 코드는 변경하지 않았다.

추가 런타임 검사에서 Next가 만든 standalone 의존성만으로 pdf-lib를 로딩하면 tslib 누락이 발생했다. 따라서 Docker는 부분 추적된 node_modules를 제외하고 별도 production-deps 단계의 전체 프로덕션 의존성 트리를 복사하도록 변경했다. 이미지 크기는 커지지만 동적 Worker 의존성을 추적 결과에만 맡기지 않는다. 이 변경 후의 Linux 이미지 실행은 Docker 환경에서 추가 확인해야 하며, 현재 standalone 폴더를 그대로 배포하지 않는다.
