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
2. `node --env-file=<env> scripts/migrate-all.mjs` (auth + 플랫폼 001~037, 다른 연결 없이). `scripts/database-check.mjs`로 점검.
3. 컨테이너: Dockerfile(standalone) 빌드·기동 검증(Linux). Cloud Run 배포는 `docs/backend/deployment-runbook.md` 참조.
4. S3/메일/PG는 각 구성 후 기능 플래그를 켜고 개별 검증. 검증 전에는 disabled 유지(launch-readiness의 storage/retention/live_payment는 실검증 증거 필요).

## 남은 것 (단계 8 실검증 — 인프라 확보 후)
- 실 PostgreSQL 동시성/마감경계, S3 브라우저 PUT/서명URL/버전, 메일·복구·retention·블라인드·인증서 워커, Docker 이미지 기동, 실 참가자 E2E(가입→제출→PG결제→접수확정→메일), 부하 목표(사용자 확인 필요).
- 이 항목들은 계정·사업자·PG 확보 전까지 실행 불가 → `docs/operator-decisions-needed.md` 참조.
