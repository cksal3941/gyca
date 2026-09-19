# 통합 진행 현황 — 접수·결제 출시 (claude-fullstack-work-order-2026-09-19 실행)

작성: Claude · 기준 지시서: `docs/claude-fullstack-work-order-2026-09-19.md`
브랜치: `frontend/live-api-wiring`

> 보고 규칙: 완료한 기능 / 검증한 환경 / 아직 안 되는 것 / 다음 작업 / 사용자 결정 필요 항목.
> 검증 범위 구분: 로컬 PGlite+브라우저 = 프런트 흐름 일부 증거, `verify-backend.mjs` = 로컬 서버 회귀 증거. 실 PostgreSQL·S3·PG·부하 검증과 동일시하지 않음.

## 단계 진행표

| 단계 | 상태 | 변경 파일/커밋 | 실행 명령·결과·증거 | 남은 차단 | 다음 작업 |
| --- | --- | --- | --- | --- | --- |
| 1 공유 기반 | ✅ 완료 | `5c3312c`,`20b294a`,`a5aac56` | 아래 검증 로그(모두 exit 0) | 없음 | 단계 2 |
| 2 로컬 운영 계정 | ✅ 완료 | `scripts/seed-leipzig-dev.mjs`(안전장치) | 운영자 200/참가자 403/회수 403/재부여 200 실세션 확인 | organizer 부여는 로컬 dev 한정(운영은 사용자 승인) | 단계 3 |
| 3 공모·접수 운영 | 미착수 | | | | |
| 4 결제·참가자 흐름 | 미착수 | | | | |
| 5 운영·보조 기능 | 미착수 | | | | |
| 6 심사·발표·인증서 | 미착수 | | | | |
| 7 공개 CMS·아카이브 | 미착수 | | | | |
| 8 스테이징·장애 검증 | 미착수 | | | | |
| 9 운영 인계 | 미착수 | | | | |

---

## 단계 1 — 공유 파일과 재현 가능한 작업 기반

### 시작 상태 (git status)
- 브랜치 `frontend/live-api-wiring`. 수정(M) 39개 tracked, 미추적(??) 122개.
- 미추적의 대부분이 **프런트가 이미 의존하는 공유 파일**: `src/contracts/**`, `src/server/**`, `src/app/api/**`, `migrations/**`, `scripts/*.mjs`, 공통 프런트(`src/lib/api/mode.ts`,`entry-view.ts`,`i18n`,`content`,`mock/fixtures.ts`,`components/ds`,`components/i18n`), `tests/**`, `docs/**`, `public/images/**`.
- 즉 클린 체크아웃 시 import 누락으로 빌드 불가 상태 → 이번 단계에서 해소.

### 제외 대상 (커밋 안 함)
- `.env*`(gitignore), `/.pglite-data`(로컬 DB), `/.pnpm-store`(캐시, gitignore 추가), `docs/e2e-*.png`(로컬 QA 스크린샷, gitignore 추가).
- `.env.example` 비밀값 없음 확인.

### 통합 커밋 (공통→백엔드→프런트)
- `5c3312c` 공통 계약·i18n·content·mock 픽스처·DS (58 파일).
- `20b294a` 서버·API 라우트·migrations·스크립트·테스트·빌드 설정 (server/**, app/api/**, migrations/**, scripts, tests/**, docs/backend, Dockerfile/tsconfig/package/lock 등).
- `a5aac56` 프런트 페이지·컴포넌트·public/images·프로젝트 문서 (home, admin/entries, archive, styleguide, submit 컴포넌트, 수정 페이지, auth/site-data, 이미지, docs).
- 결과: `git status` 클린(ignore만 남음). 이제 브랜치가 클린 체크아웃에서 빌드 가능.

### 클린 체크아웃 검증 (임시 worktree `../gyca-verify` = HEAD 트래킹 파일만)
| 명령 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile --prefer-offline` | exit 0 (8.3s, 전역 store 캐시) |
| `pnpm build --webpack` | **exit 0** — 전 라우트/API/페이지 컴파일. (과거 Turbopack pako Windows 오류는 webpack에선 없음) |
| `tsc --noEmit --incremental false` (빌드 후) | **exit 0** — B-2(admin-entry-detail) 미재현. (빌드 전엔 Next 자동생성 `LayoutProps` 전역 미존재로 1건 실패 → 타입젠=빌드가 선행돼야 함) |
| `node scripts/verify-backend.mjs` | **exit 0** — 269 tests pass/0 fail + 타입체크 + 백엔드 린트 |
- worktree 제거 완료(`git worktree remove --force`). 검증은 원 폴더의 미추적 파일 없이 성공 → 누락 import 없음.
- **검증 범위 주의:** 로컬 PGlite 기반. 실 PostgreSQL·S3·PG·부하는 미검증(단계 8에서).

### 완료 기준 대비
- ✅ 클린 체크아웃 import 누락 없음 · ✅ 필요한 파일 전부 추적 · ✅ 실행 명령·exit 0 기록.

---

## 단계 2 — 재현 가능한 로컬 운영자·심사 테스트 환경

### 재현 절차 (개발 전용)
```bash
# 1) 프레시 로컬 DB (PGlite 소켓 서버, 멀티커넥션)
rm -rf .pglite-data
node_modules/.bin/pglite-server -d ./.pglite-data -p 5432 -h 127.0.0.1 -m 30   # 백그라운드

# 2) .env.local: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres,
#    BETTER_AUTH_SECRET=<random>, BETTER_AUTH_URL=http://localhost:3000, NEXT_PUBLIC_API_MODE=live
#    GYCA_PAYMENT_PROVIDER/GYCA_STORAGE_PROVIDER/GYCA_EMAIL_PROVIDER=disabled

# 3) 전체 마이그레이션 (auth + platform 001~037) — 다른 연결 없이 실행
node --env-file=.env.local scripts/migrate-all.mjs      # 76개 테이블 생성

# 4) 개발 공모 시드 (opt-in 필수)
GYCA_DEV_SEED=1 node --env-file=.env.local scripts/seed-leipzig-dev.mjs

# 5) 앱
pnpm dev
```
- **클린 migrate-all 정상 확인:** 프레시 DB에 auth + 37개 플랫폼 마이그레이션 전부 적용, `pg_tables` 76개. (이전 세션의 flakiness는 dev 서버 동시 연결 중 마이그레이션한 수동 개입 탓; 단독 실행 시 정상.)
- **seed 안전장치(단계 2.4):** `GYCA_DEV_SEED=1` opt-in + DATABASE_URL이 localhost/127.0.0.1 + `NODE_ENV!==production` 아니면 거부. 임의 접속 문자열 자동 시드 금지. (거부→성공 실증)

### 테스트 계정 (Better Auth 실제 경로, 로컬 dev 전용)
| 역할 | 이메일 | 준비 방법 |
| --- | --- | --- |
| 참가자 | participant@gyca.test | signup |
| 운영자 | operator@gyca.test | signup → `emailVerified=true`(dev) → `manage-organizer.mjs --apply`(grant) |
| 심사위원 | judge@gyca.test | signup → 운영자가 `PUT /admin/judges/{id}` active=true |
- 공용 dev 테스트 비밀번호 `test1234pw`(로컬 throwaway DB 전용, 운영 비밀 아님).
- **권한 게이트 주의:** organizer 부여/emailVerified 변경은 이 지시서(단계 2)가 명시 요구해 로컬 dev DB에서만 수행. 운영 계정 권한 부여는 사용자 승인 범위. seed/organizer 도구는 계정 대조·미리보기·감사(`gyca_organizer_access_audit`) 흐름 유지.

### 검증 (실제 세션)
| 확인 | 결과 |
| --- | --- |
| 운영자 GET `/admin/competitions` | **200** |
| 참가자 GET `/admin/competitions` | **403** |
| organizer 회수 후 운영자 GET | **403** |
| 재부여 후 운영자 GET | **200** (operator 복구) |
| 심사위원 활성화 `PUT /admin/judges/{id}` | **200** active:true |
