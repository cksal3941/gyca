# 통합 진행 현황 — 접수·결제 출시 (claude-fullstack-work-order-2026-09-19 실행)

작성: Claude · 기준 지시서: `docs/claude-fullstack-work-order-2026-09-19.md`
브랜치: `frontend/live-api-wiring`

> 보고 규칙: 완료한 기능 / 검증한 환경 / 아직 안 되는 것 / 다음 작업 / 사용자 결정 필요 항목.
> 검증 범위 구분: 로컬 PGlite+브라우저 = 프런트 흐름 일부 증거, `verify-backend.mjs` = 로컬 서버 회귀 증거. 실 PostgreSQL·S3·PG·부하 검증과 동일시하지 않음.

## 단계 진행표

| 단계 | 상태 | 변경 파일/커밋 | 실행 명령·결과·증거 | 남은 차단 | 다음 작업 |
| --- | --- | --- | --- | --- | --- |
| 1 공유 기반 | 진행 | — | — | — | 통합 커밋 + 클린 체크아웃 검증 |
| 2 로컬 운영 계정 | 미착수 | | | | |
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
