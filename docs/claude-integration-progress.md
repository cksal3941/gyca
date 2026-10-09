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
| 3 공모·접수 운영 | ✅ 대체로(3-A✅ **3-B 폼 전필드✅**) | +`CompetitionForm/Editor`,`LaunchControl`,admin/competitions{,/new,/[id]} | **CompetitionEditSchema 전 필드 편집**(제목·참가비·시간대·접수/결제창·요강·일정표·전시·나이기준일·부문·연령·필드·업로드) 저장→영속→재로드 실검증. 일정/전시/나이기준일 라운드트립 + 미승인 장소 자동 비공개(refine) 검증 | 동의문·정책 값은 결정 대기·open은 readiness/결정 게이팅 | 결정 수신 후 오픈 / 단계 4~ |
| 4 결제·참가자 흐름 | 진행(4-A 착수·**mock 감사✅**) | `index.ts`(beginCheckout),`submit-flow.ts`,`docs/live-mock-remnants.md` | checkout 라우트 404 정상·draft payment-options=[]·**라이브 mock 잔재 전수 감사 문서화** | 실 주문→checkout→PG 해피패스는 S3·PG 인프라·사업자 대기 | confirm/reconcile(주문 후) |
| 5 운영·보조 기능 | 진행(조회✅ **개인정보요청 E2E✅**) | `ops.ts`(dashboard/health/reviews,privacy admin),`admin/payments`,`admin/privacy`,`index.ts`(privacy),mypage privacy 패널 | 대시보드 실데이터·게이트·gross / **개인정보: 참가자 요청→취소, 운영자 검토시작→보존보류(증거)→재개 실검증(파기승인은 비가역이라 게이트만)** | accept-late/requeue/환불 mutations·인증서·프로필 편집(계약없음) 미착수 | 결제 mutations·보조 기능 |
| 6 심사·발표·인증서 | 진행(심사화면✅ 관리자 judges/rubric✅ **인증서 다운로드 배선✅**) | `ops.ts`(judge admin),`admin/judges`,`index.ts`(downloadCertificate),mypage cert 버튼 | judges·rubric 실검증 / **인증서 다운로드 어댑터·버튼 배선**(엔드포인트 404 도달 실검증; 발급본은 S3·심사 후) | 배정 관리·결과 발표·인증서 발급(발급 데이터는 인프라·심사 대기) | 결과 발표(엔트리·인프라 후) |
| 7 공개 CMS·아카이브 | 진행(editorial 목록+상세+**수정**✅ partner관리+**수정**✅) | +`getEditorialPublic`,`NoticeDetailView`,notices/[slug],editorial/partner admin edit,`updatePartner` | editorial/partner **수정 폼→update→반영 실검증**(editorial 공개 API 최대 60s 캐시) / 생성·관계·발행·공개 검증 | 홈 PartnerMarquee·NewsUpdate(하드코딩 마케팅)·아카이브(신규 서버계약) 미착수 | 아카이브(대규모)·홈 마케팅 배선(선택) |
| 8 스테이징·장애 검증 | 진행(준비✅) | `.env.example`,`docs/staging-readiness.md` | 프로덕션 빌드(webpack) HEAD exit 0·env 완비·준비 체크리스트 | 실 DB/S3/PG/메일 검증·Docker 기동·부하는 계정·사업자 대기 | 계정 확보 후 실검증 |
| 9 운영 인계 | 진행(운영가이드✅) | `docs/operations-guide.md` | 구축 기능 기준 운영 가이드(권한·공모·접수·결제·심사·CMS·복구) | 출시 판단·최소출시 체크리스트·최종 검증 증거는 실검증/결정 후 | 최소출시 체크리스트(실검증 후) |

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

---

## 단계 3 — 공모·접수 운영

### 3-A 관리자 상세 + CSV ✅
- `getAdminEntryDetail` → GET `/admin/competitions/{id}/entries/{entryId}`(AdminEntryDetailSchema). 신규 클라 `AdminEntryDetailLive`가 계약 그대로 렌더(files.displayName, guardianVerificationStatus, audit type/actorId/occurredAt ≤100, 인증서) — verified/작성자 날조 안 함. 목록→상세 competitionId 보존(URL `?competition=`).
- `exportAdminEntriesCsv` → POST `.../entries/export`(전체 결과셋) → text/csv Blob 다운로드(개인정보 안내), 오류 JSON. 일괄 발표/인증서 live 비활성.
- **검증(operator):** 상세 200 계약 shape, CSV attachment Blob(BOM+헤더), participant 403, 브라우저 전 섹션 렌더.
- **후속:** 동의 전문/보호자 수동검증(mutation), 관리자 파일 열람 전용 API.

### 3-B 공모 등록·오픈 (백엔드 흐름 실측 + 결정 요청)
- **create→open 실측(operator, curl):** `POST /admin/competitions` → 201(revision 1, draft/payment=false). `GET /launch-readiness` → public_content·schedule=configured, published·form·consents·guardian_policy·payment_policy·payment_routes·storage·retention·live_payment_verification=missing. `POST /open-applications`(rev 1) → 503 POLICY_NOT_CONFIGURED(정확히 차단).
- **결론:** 오픈은 readiness 전부 충족 필요 → 다수가 외부 검증·운영 정책 결정 게이팅(3-B.5 임의 충족 금지). `docs/operator-decisions-needed.md`로 결정 요청(A PG/통화 최우선 ~ G 자료).
- **어댑터 추가(데이터층):** `getAdminCompetition`/`createCompetition`/`updateCompetition`/`getLaunchReadiness`/`openApplications`/`pauseApplications`/`resumeApplications`(ops.ts, 계약 스키마 검증). tsc·eslint 0. 기반 엔드포인트는 create 201·readiness·open 503 실측 완료.
- **다음 증분(UI):** 공모 create/edit 폼(핵심 필드 + categories/ageGroups, fields/uploads는 edit 라운드트립) · 정책 편집(submission/payment/retention)+동의문 버전 · launch-readiness 표시 + verification 등록 · open/pause/resume 버튼(어댑터 준비됨). 상당수 입력값은 결정 수신 후.
- **4-A.1 홈 Apply:** ApplyCta를 실제 공모 응답(start_entry) 게이트로 전환(커밋 `a919416`).

## 사용자 결정 필요 (요약 — 상세는 operator-decisions-needed.md)
- **A. PG·통화(최우선):** 사업자 국가/법인, PG 계약 상태, 청구·정산 통화(EUR 가능 여부), 해외카드/국가, 환불.
- B~G: 공모 기본정보 / 일정·접수성립·환불 / 폼·파일규격 / 법적문구·동의·보호자정책 / 외부계정(클라우드·DB·S3·메일) / 표시·자료(사업자정보·요강·아카이브).

---

## 코덱스 회고 검토 후속 (docs/backend/retrospective-decisions-2026-09-19.md) — 5단계

코덱스가 회고의 계약 대기를 해소(migration 038·039, 아카이브·공모카드·프로필·보호자·동의 결정)하고 5단계 지시를 전달. 로컬 PGlite에 038·039 적용 완료(037→039).

### 1단계: 공개 카드 연결 — ✅ 완료·검증
- 어댑터: `listCompetitionCards`(index.ts, GET `/content/competition-cards`, CompetitionCardSchema), `getCompetitionPresentation`/`updateCompetitionPresentation`(ops.ts, admin GET/PUT).
- `/contests` **dual-mode 재작성**: 라이브=카드, mock=기존 샘플. 공통 RowVM으로 정규화해 **디자인 마크업 그대로 유지**. presentation null 요소는 숨김(요약/도시/분류/표지), 접수기간=실제 opensAt–closesAt, Apply=서버 `start_entry`만.
- 관리자 편집에 `PresentationEditor`(별도 저장 버튼·evidence 필수·revision·409 충돌 처리) 추가(CompetitionEditor).
- **검증(operator, 라이브):** 카드 4건 렌더(Apply는 leipzig=start_entry만) / presentation 저장(revision 0→1) → 공개 카드에 summary·category 반영 / **city는 admin 저장되나 전시 미승인이라 공개 응답 null(승인 게이팅)** / 공개 /contests 페이지에 요약·분류 배지·Apply 렌더, city 숨김. (pglite 동시성으로 카드 목록이 일시 빈 응답 → 재조회 정상, 앱 무관.)

### 2단계: 완료 프로젝트 CMS + 공개 아카이브 — ✅ 완료·검증
- **공개(2a):** `listProjects/getProject/listWinners/listExhibitions`(index.ts). `ProjectCollectionView`(프로젝트 단위 컬렉션 — per-winner 억지변환 안 함) + `ArchivePublicView`(섹션 렌더: intro/gallery/documents/quotes/stats, pending=제목+안내만). `/winners`·`/exhibitions` dual-mode(라이브=컬렉션, mock=기존 샘플), `/archive` 인덱스 + `/archive/[slug]` 상세.
- **관리자(2b):** `listAdminProjects/getAdminProject/createProject/updateProject/publishProject/archiveProject`(ops.ts). `ArchiveForm`(hero + 1~10 섹션, 종류/순서 중복검사, ready 콘텐츠 요구, 미디어=사이트경로/https, ArchiveContentSchema 검증) + `ArchiveEditor`(발행 근거 입력·보관 확인 게이트·**발행본 수정=초안 강등 경고**). 목록/신규/편집 페이지 + admin 네비 링크.
- **검증(operator, 라이브):** 데모 프로젝트 생성(API)→발행→`/content/projects·winners·exhibitions` 각 1건, 상세 3섹션(intro/선정작/전시·인용·통계) 공개 렌더 / 관리자 목록·편집 로드(공개 상태·보관 컨트롤·발행 컨트롤 숨김·수정 경고·3섹션) / **UI 신규 생성→편집 리다이렉트** / **UI 보관 확정→상태 보관→공개 상세 404**(터미널·비공개 검증).
- 규칙 준수: 발행본 수정 시 초안 강등 안내, archived 복구불가 안내, 공개 pending 섹션 payload 서버 제거, 미디어 업로더 없음(승인된 URL만).

### 3단계: 보호자·프로필 마무리 — ✅ (프로필·보호자 페이지·오류 처리 완료 / 정상흐름=서버테스트)
- **프로필:** mypage 개인정보 탭의 정적 "준비 중" 폼 제거 → `/settings`(Better Auth) 연결. 접수 인적사항은 접수 단계 입력임을 안내. **검증(브라우저):** `/settings` 이름 변경→"Profile updated"→세션 반영→원복.
- **보호자 어댑터:** `getGuardianStatus`/`requestGuardianConsent`(참가자), `previewGuardianConsent`/`acceptGuardianConsent`(보호자, 토큰). 응답 계약 부재라 클라이언트 스키마로 방어 검증. 토큰은 응답에 노출 안 함(요청 body로만).
- **보호자 페이지 `/guardian-consent`:** URL fragment 토큰(쿼리 아님) → preview(3동의문) → 성함+전체동의 → accept. 공개(로그인 불필요).
- **참가자 패널(EntryDetailView):** 상태 표시 + 요청/재요청. 기능 OFF(503)면 자체 숨김.
- **검증 등급 구분:**
  - **서버 테스트 통과(정상 흐름):** `node --test tests/submission-api.test.mjs …` 20/20 — "guardian link records three consents without bypassing identity verification"(주입 mailer로 preview→accept 검증) + rate-limit/admin evidence.
  - **브라우저 확인(오류 처리):** 기능 OFF→preview 503→페이지 "미활성"; 기능 ON→무효 토큰 404 NOT_FOUND→"무효 링크"; 무토큰→"무효 링크". 만료/stale은 동일 "무효" 매핑(서버 판정). 검증 후 플래그 기본값(OFF) 복원(로컬 메일러 없어 실요청 불가).
  - **실서비스 확인(미완, 5단계):** 실제 이메일 링크로 보호자가 수락하는 브라우저 E2E는 로컬 HTTPS + 테스트 메일 수신함 구성 후. 운영 API 토큰 노출·HTTPS 해제는 하지 않음.

### 4단계: 남은 관리자 변경 — 진행 (4a 결제 mutation ✅)
- **어댑터(ops.ts):** `requeueRecovery`, `acceptLatePayment`(→AcceptLatePaymentResult), `getRefundOverview`, `requestRefund`(→RefundOverview). 모두 서버 allowedActions/권한 게이팅.
- **UI(admin/payments):** 검토 주문 행에 `복구 재큐`·`지연 승인`(사유 인라인 입력, expectedUpdatedAt/expectedReviewedAt 낙관적 동시성) 버튼을 **allowedActions에만** 표시. 처리 후 원장 재조회. 주문별 `환불` 패널(조회→request_refund 있을 때만 요청). 브라우저 dialog 미사용(인라인 폼).
- **격리 테스트 데이터:** `manage-payment-access.mjs --apply`로 operator@gyca.test에 leipzig-2027 결제 operator 권한 부여(dev, 감사 기록).
- **검증 등급:**
  - **브라우저(엔드포인트 도달+게이팅):** 권한 전 4개 엔드포인트 403 FORBIDDEN → 권한 부여 후 health/reviews 200, 가짜 주문 requeue·refund 404 NOT_FOUND(authz 통과, 존재만 없음). payments 페이지: health·검토목록(빈)·환불 패널 렌더, 조치 버튼은 allowedActions에만.
  - **상태변경(요청→상태변경→재조회):** 실주문이 없어 미검증 — 격리 주문/복구/검토 fixture 시드 필요(코덱스 서버 테스트가 해피패스 커버). 완료 결제 임의 변경 UI 없음.
  - **실서비스:** 실 PG 승인/환불은 5단계.
- **미착수(4단계 잔여):** 결과 발표(공개/라운드)·인증서 발급 화면 — received+심사완료 fixture 필요(깊은 파이프라인 시드).

### 4단계: 남은 관리자 변경 — 4b 결과 발표·인증서·심사결정 ✅ (4단계 완료)
- **어댑터(ops.ts):** `getReviewDecision`/`updateReviewDecision`(per-entry), `publishResultsRound`(official_selection/finalist), `issueCertificates`.
- **UI:** `/admin/results`(공모 선택 → 공모 revision → 1차(Official Selection)/2차(Finalist) 발표 버튼 + 인증서 발급 폼[stage·entryIds]) + admin 네비 링크. 관리자 접수 상세(`AdminEntryDetailLive`)에 **심사 결정 편집기**(심사상태+결과, 완료 시 결과 필수, finalist는 발표 전 내부 보관 안내, 엔드포인트 없으면 자체 숨김).
- **검증 등급:**
  - **브라우저(엔드포인트 도달+게이팅):** publish official_selection → 409(precondition/concurrency), cert issue(가짜 entry) → 409 ENTRY_LOCKED, review GET(가짜 entry) → 404 — 모두 authz 통과한 서버 판정. results 페이지: revision·1차/2차 발표 버튼·인증서 폼 렌더.
  - **상태변경(발표 성공·인증서 발급·결정 반영):** received+심사완료 접수 파이프라인이 없어 미검증 — 코덱스 서버 테스트(result-publication/certificates)가 해피패스 커버. 실제 발급 PDF는 S3 작업자(5단계).
  - **실서비스:** 실 결과·인증서 발급은 5단계.
- **4단계 요약:** 결제 mutation(4a) + 결과 발표·인증서·심사결정(4b) 화면·어댑터 완료. 상태변경 해피패스는 격리 파이프라인 시드/서버테스트 영역, 실 발급은 인프라 대기.

### 4단계 상태변경 검증 (격리 fixture, 라이브 API) — 추가 완료
지시서 요구("격리 접수·주문·심사 fixture로 성공/거절/중복 검증, 외부 계정 없이 로컬 검증 미루지 않음")에 따라 개발 DB에 격리 fixture를 시드해 **요청→상태변경→재조회**를 라이브 API로 검증(공급자 불필요 mutation).
- **지연 승인(accept_late_payment) — 상태변경 ✅:** 마감 후 승인 주문 시드(order succeeded+needs_review, payment_events outcome=review, paidAt>마감) → payment-reviews에 `reviewReasons=[APPROVED_AFTER_DEADLINE]`·`allowedActions=[accept_late_payment]` → POST accept-late → **200 receipt_issued(접수번호 발급)**, **엔트리 status=received·received_at 기록**, 불변 감사기록(action=accept_late_payment), 목록에서 제거. **멱등**: 동일 actionId+본문 재요청 동일 결과.
- **복구 재큐(requeue_recovery) — 상태변경 ✅:** stalled 복구 주문 시드 → `allowedActions=[requeue_recovery]` → POST requeue → **200 recovery_queued**, **복구 state stalled→pending·attempts 0 리셋**, 불변 감사기록.
- **환불 실행:** 결제 공급자 필요(로컬 GYCA_PAYMENT_PROVIDER=disabled) → 라이브 상태변경 미검증, 코덱스 refund 서버 테스트가 해피패스 커버. 엔드포인트 도달·게이팅은 확인.
- **결과 발표·인증서·심사결정:** 심사 결정 PUT → 409 `ENTRY_LOCKED`(공모 단계·심사배정 완료 등 더 깊은 전제 필요) → 엔드포인트 도달·전제 게이팅 확인. 해피패스는 코덱스 result-publication/result-rounds/certificates 서버 테스트 커버.
- **fixture 정리:** `gyca_submissions` 불변 트리거로 삭제 불가(의도된 evidence 무결성) → 시드 fixture는 격리 dev 데이터로 잔존. 시드 스크립트 `scripts/seed-late-payment-dev.mjs`(GYCA_DEV_SEED=1 + localhost 가드).

### 4b 결과 파이프라인 상태변경 검증 (격리 fixture, 라이브 API) — 추가
throwaway 공모(phase=judging, 마감 경과, retention 설정) + received 엔트리 시드 후 라이브 API로 검증:
- **심사 결정(updateReviewDecision) — 상태변경 ✅:** completed+official_selection PUT → 200, 재조회 reviewStatus=completed·decision 반영(마감 경과+judging 단계 충족 시 ENTRY_LOCKED 해제).
- **결과 발표(official_selection) — 상태변경 ✅:** POST results/publish → 200, round=official_selection·selectedCount=1·resultingRevision=2, 엔트리 publishedResult=official_selection.
- **인증서 발급 — 미검증(500):** 최소 fixture의 빈 제출 스냅샷(`{}`)으로는 인증서 스냅샷 생성 불가 → 실 제출 파이프라인(스냅샷) 필요, 코덱스 certificates 서버 테스트가 해피패스 커버. 엔드포인트 도달은 확인.
- **정리:** throwaway 공모는 공개 카드 노출 방지를 위해 published=false 처리. 시드 스크립트 `scripts/seed-results-dev.mjs`(GYCA_DEV_SEED=1 가드). submission 불변 트리거로 엔트리 완전 삭제는 불가(의도된 무결성).

**4단계 상태변경 요약:** 공급자·실 스냅샷 불필요 mutation은 라이브 상태변경 검증 완료 — accept-late, requeue, **심사결정, 결과발표(official_selection)**. 미검증(외부 의존): 환불(공급자), 인증서 발급(실 스냅샷), finalist 라운드(official_selection 공개 후 결정 갱신 필요) — 모두 코덱스 서버 테스트 커버.
