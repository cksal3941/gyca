# 스테이징/배포 준비 현황 (단계 8)

작성: Claude · 기준: `docs/claude-fullstack-work-order-2026-09-19.md` §10
> 비밀값은 적지 않는다. 여기는 "무엇이 준비/미준비이고 누가 담당인지"의 체크리스트.

## 빌드·코드 준비 (계정 불필요 — 완료)
| 항목 | 상태 | 증거 |
| --- | --- | --- |
| 프로덕션 빌드 | ✅ | `pnpm build --webpack` 현재 HEAD **exit 0**(전 라우트/API 컴파일) |
| 타입체크 | ✅ | `tsc --noEmit`(빌드 후) exit 0 |
| 백엔드 검증 | ✅ | `node scripts/verify-backend.mjs` exit 0 · 269 tests |
| 클린 체크아웃 재현성 | ✅ | 단계 1 worktree 검증(누락 import 없음) |
| Node 런타임 | 24 계열 | Dockerfile `node:24-alpine` |
| 출력 모드 | Cloud Run=standalone, Vercel=플랫폼 기본 | `next.config.ts`(VERCEL 분기) |

⚠️ Turbopack 기본 빌드는 과거 Windows에서 pako 파일 오류(os error 5) 이력 → **webpack 빌드로 검증**함. 배포 빌드 명령은 `next build --webpack` 권장.

## 서비스별 준비 (외부 계정 필요 — 사용자/대표 결정)
| 서비스 | 필요성 | 상태 | 담당/필요 결정 |
| --- | --- | --- | --- |
| PostgreSQL(관리형) | 필수(모든 API) | ⬜ 미준비 | Supabase/Cloud SQL/Neon 계정 → `DATABASE_URL` |
| S3(private/versioned) | 업로드·다운로드·블라인드 | ⬜ 미준비 | AWS 계정·버킷·CORS·버전관리·공개차단 → `GYCA_S3_*` |
| PG(결제) | 결제 오픈 | ⬜ 미준비 | 사업자 등록→PG 가맹계약(통화/해외카드 확인) → 결제 키 |
| 메일(Resend 등) | 인증·접수·영수증 메일 | ⬜ 미준비 | 도메인·발신자 검증 → `RESEND_API_KEY`·`RECEIPT_EMAIL_*` |
| 호스팅 | 앱 실행 | 🔶 Vercel 프리뷰 사용 중 | Cloud Run(문서 기준) 또는 Vercel+관리형 PG 택1 |

## 배포 환경변수 (`.env.example` 참조, 비밀값 제외)
- 필수: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_API_MODE=live`
- 선택/기능 플래그(기본 disabled): `GYCA_STORAGE_PROVIDER`/`GYCA_S3_*`, `GYCA_PAYMENT_PROVIDER`/`TOSS_*`, `GYCA_EMAIL_PROVIDER`/`RESEND_API_KEY`, 각 워커 토큰(`*_JOB_TOKEN`)·`*_ENABLED`
- 자동설정(입력 불필요): `NODE_ENV`(런타임), `VERCEL`(Vercel)
- 개발 전용: `GYCA_DEV_SEED=1`(seed 스크립트 opt-in) — 운영 금지

## 마이그레이션·배포 절차 (요약)
1. 관리형 Postgres 준비 → `DATABASE_URL` 설정.
2. `node --env-file=<env> scripts/migrate-all.mjs` (auth + 플랫폼 **001~039**, 다른 연결 없이). `scripts/database-check.mjs`로 점검. (038 project archives, 039 competition presentation 포함.)
3. 컨테이너: Dockerfile(standalone) 빌드·기동 검증(Linux). Cloud Run 배포는 `docs/backend/deployment-runbook.md` 참조.
4. S3/메일/PG는 각 구성 후 기능 플래그를 켜고 개별 검증. 검증 전에는 disabled 유지(launch-readiness의 storage/retention/live_payment는 실검증 증거 필요).

## 5단계 실행 순서 (계정 확보 후 turnkey — Claude가 코드/절차 준비 완료, 실행만 남음)
각 단계는 **외부 계정 → env → 검증 명령 → readiness** 순. 비밀값은 배포 시크릿에만 넣고 저장소/문서에 남기지 않는다.
1. **DB:** 관리형 Postgres 생성 → `DATABASE_URL` → `scripts/migrate-all.mjs`(001~039) → `scripts/database-check.mjs` 통과. → `NEXT_PUBLIC_API_MODE=live`, `BETTER_AUTH_SECRET/URL` 설정 후 앱 기동, 가입/로그인/공모 조회 200 확인.
2. **S3:** 버킷(private·versioned·public 차단·CORS) → `GYCA_STORAGE_PROVIDER=s3`+`GYCA_S3_*` → `scripts/storage-check.mjs` 통과 → 브라우저 업로드 PUT→complete→다운로드 서명URL, 블라인드/인증서 워커 확인. launch-readiness.storage=configured 증거 등록.
3. **메일:** 발신 도메인·발신자 검증 → `GYCA_EMAIL_PROVIDER=…`+키, `*_ENABLED` → 인증 메일·접수 영수증·보호자 링크 수신 확인(격리 수신함). `GYCA_GUARDIAN_CONSENT_ENABLED=true`는 HTTPS origin+메일 준비 후에만.
4. **PG(결제):** 사업자 등록→PG 가맹계약(통화/해외카드) → `GYCA_PAYMENT_PROVIDER=tosspayments-test`(먼저 테스트키)+`TOSS_*` → 주문→checkout→승인→접수확정→환불 해피패스, `POST .../launch-verifications`에 live_payment 증거 등록. 실키 전환은 최종.
5. **오픈:** launch-readiness 13개 check 전부 configured → `canOpen=true` → `POST .../open-applications`. 플래그/DB 직접 수정으로 통과시키지 않는다.
6. **부하·장애:** 마감 직전 동시 업로드/결제, 콜백 중복/지연, 백업 복원 — 사용자 확인 목표치로 검증.

## 남은 것 (5단계 실검증 — 인프라 확보 후, 위 순서대로)
- 실 PostgreSQL 동시성/마감경계, S3 브라우저 PUT/서명URL/버전, 메일·복구·retention·블라인드·인증서 워커, Docker 이미지 기동, 실 참가자 E2E(가입→제출→PG결제→접수확정→메일), 부하 목표.
- **로컬에서 검증 완료된 상태변경**(참고): accept-late·requeue·심사결정·결과발표(official_selection) — `docs/claude-integration-progress.md` 4단계. 환불·인증서·finalist는 공급자/실 스냅샷 필요로 서버 테스트가 커버.
- 계정·사업자·PG 확보 전까지 실행 불가 → `docs/operator-decisions-needed.md` 참조.
