# 중간 점검 — 프런트엔드 (2026-09-19)

작성: Claude(프런트) · 대상: 사용자 + Codex(백엔드)
브랜치: `frontend/live-api-wiring` (origin에 푸시됨, master보다 7커밋 앞섬, PR #1 OPEN)

---

## A. 지금까지 한 작업 (요약)

### A-1. 실 API 연결(1차) — 대체로 완료
로컬 라이브 환경(PGlite 소켓 DB + `NEXT_PUBLIC_API_MODE=live` + seed 공모)에서 브라우저로 실검증하며 배선.

- **참가자 읽기:** 공모 목록·상세(`/competitions`,`/{slug}`), 본인 접수 목록·상세(`/entries`,`/entries/{id}`), 제출기록(`/entries/{id}/submission`), 주문(`/orders`), 운영권한(`/admin/access`).
- **참가자 쓰기/제출:** 초안 생성(POST)·수정(PATCH), 새로고침 복원, submission-readiness, 제출(POST /submit), 업로드 어댑터(예약→PUT→complete→검증), 결제경로·주문생성(결제창 PG는 미선정).
- **제출 파일 다운로드(§3.7):** `downloadSubmissionAsset` → POST `/entries/{id}/submission/assets/{assetId}/download`(60초 서명 URL). 접수상세 제출파일에 다운로드 버튼.
- **심사(judge) 블라인드:** 배정목록·리뷰컨텍스트·초안저장(PUT)·최종제출(POST). revision 낙관적잠금(REVISION_CONFLICT 표시), 블라인드 파일 미준비 처리.
- **관리자 접수 목록:** 공모 선택(`/admin/competitions`) + 접수 목록(`/admin/competitions/{id}/entries`, 전 필터/정렬/커서). 커서 스택 페이지네이션(mock/live 겸용).

### A-2. 라이브 QA로 잡은 수정
- **SSR 어댑터 미동작(핵심 버그):** async 서버 컴포넌트가 상대 URL+same-origin 쿠키 어댑터를 호출하면 SSR서 실패 → 접수상세 하드404, Leipzig Apply CTA 미표시. **클라이언트 전환**으로 해결(접수상세·결제·Leipzig Apply·심사 리뷰 모두 얇은 서버 셸 + 클라 fetch).
- **공모명 "—"(§0-A #5):** `listCompetitions`(GET /competitions)로 id→title 맵 → 실제 표시.
- **정직성:** 접수 인트로 문구 live/mock 분기, 개인정보 탭 "준비 중"+비활성, dev 시나리오 바 live 숨김, NOT_CONNECTED/FORBIDDEN 친절 문구.

### A-3. 검증
- 각 변경 파일 tsc(비-server) 0 · eslint 0. 백엔드 테스트 스위트 239 pass.
- 라이브 실검증: 가입/로그인, 공모조회, 접수 생성·수정, 마이페이지 목록·상세, readiness, 다운로드 에러매핑, judge/admin 비권한 403 우아처리.

### A-4. 커밋(브랜치)
`03168b4`(SSR수정+공모명) · `3b2a8e9`(프로필) · `39958c2`(다운로드) · `059b78c`(심사) · `c08ba93`(관리자목록) · `917836e`(handoff §0-C).

---

## B. Codex에 전달할 사항

### B-1. 🔴 병합 전 필수 — 공유 파일 미커밋 의존성
프런트 브랜치가 아직 **커밋되지 않은 공유 파일**에 의존합니다. master로 병합하면 **빌드가 깨집니다.** 병합 전 이 파일들을 함께 올리거나 순서를 조율해야 합니다.

- **Codex 소유:** `src/contracts/**` (모든 계약)
- **프런트 공유(미커밋):** `src/lib/api/mode.ts`, `src/lib/entry-view.ts`, `src/lib/mock/fixtures.ts`, `src/lib/i18n/**`, `src/lib/content/**`, `src/components/ds/**`, `src/components/i18n/**`
- (참고) `src/lib/api/http.ts`, `src/lib/api/index.ts`, `ops.ts`는 이미 브랜치에 커밋됨.
- **권장 순서:** 공유 계약(`src/contracts`)을 master(또는 공용 base)에 먼저 커밋 → 프런트·백엔드 브랜치가 거기서 갈라지도록 정리 → PR 순차 병합.

### B-2. 🟠 계약 타입 에러 — `src/contracts/admin-entry-detail.ts`
- `AdminEntrySchema.unwrap().extend(...)`가 **tsc 타입 에러**(`Property 'extend' does not exist on ZodReadonly`). **런타임은 정상**(safeParse 동작)이나 프로젝트 clean typecheck가 실패.
- 이게 수정돼야 **관리자 상세 화면 배선**을 깔끔히 진행할 수 있음.

### B-3. 🟠 관리자 상세 배선 보류 사유(계약 shape 불일치)
`/admin/entries/[id]`는 아직 mock. 라이브 배선하려면 화면 재설계 필요 — 현재 화면(mock view)과 계약 `AdminEntryDetailSchema`가 다름:
- `audit`: mock `{at,actor,action,detail}` ↔ 계약 `{type,actorId,occurredAt}`
- `allowedActions`: mock `publish_result/request_export/...` ↔ 계약 `[view_guardian_consents, issue_certificate]`
- `guardianVerification`(string) ↔ `guardianVerificationStatus`(enum), `files.name` ↔ `displayName`
→ 계약을 확정 기준으로 화면을 맞출 예정(B-2 해결 후).

### B-4. 🟡 관리자 일괄 발표/인증서 + CSV
- 서버 라우트는 존재(result-publication, certificates/issue). 프런트는 아직 mock → **live서 비활성("준비 중")** 처리. 배선은 organizer 검증 환경 확보 후.

### B-5. 🟡 검증에 필요한 것(인프라·계정)
아래가 없어 **해피패스 미검증**. 붙으면 이어서 실검증하겠습니다.
- **DB/S3/PG:** 업로드→제출→주문 풀 E2E, 블라인드 에셋. (현재 로컬은 PGlite, storage/PG disabled)
- **결제창(PG) 선정:** checkout API 없음 → 주문 생성·폴링까지만. 실 결제 흐름 배선 불가.
- **organizer/judge 테스트 계정(또는 seed 절차):** 관리자·심사 해피패스는 전면 권한 게이트라 로컬 검증 불가(권한 부여는 이 세션에서 안전 게이트로 차단됨).
- **마이그레이션:** 프로덕션 migrate 시 최신(≥029 certificates)까지 적용돼야 `/api/v1/certificates` 등이 500 안 남(로컬에선 순차 적용 확인).

---

## C. 남은 작업 / 다음 단계
1. (Codex) B-1 공유파일 병합 순서 + B-2 계약 타입에러 수정.
2. (Claude, B-2 후) 관리자 상세 배선.
3. (환경 확보 후) 관리자 일괄/CSV 배선 + organizer·judge·풀 E2E 실검증.
4. (마지막) 브랜치 정리 → master 병합.
