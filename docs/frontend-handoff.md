# 프런트엔드 인계 — Claude → Codex (통합 단일 진입 문서)

최종 갱신: 2026-09-17. 프런트(화면·상태표시·mock)는 Claude, 서버·DB·인증·결제·PDF·권한은 Codex.
**현재 접수/결제/관리자/심사 관련 실 연결은 0** — better-auth 로그인/세션만 실제. 나머지는 mock 어댑터.
상세 계약 제안: [submit-flow-contract-proposal.md](./submit-flow-contract-proposal.md),
[admin-judge-contract-proposal.md](./admin-judge-contract-proposal.md),
[frontend-notes-for-backend.md](./frontend-notes-for-backend.md). 서버 측 누적 인계는 [backend/claude-handoff.md](./backend/claude-handoff.md).

---

## 0-A. 실 API 연결 진행 (1차, 2026-09-17~)

**모드 스위치**: `src/lib/api/mode.ts` — `NEXT_PUBLIC_API_MODE=live`면 실 연결, 미설정 시 `mock`(기본). `isLive`, `notConnected()`. 라이브 실패는 **오류 상태로 표시**하고 mock으로 대체하지 않음. 라이브에서 dev 시나리오 버튼 숨김(mypage 적용).

**공통 HTTP 어댑터**: `src/lib/api/http.ts` — `httpGet`/`httpSend`/`httpList`. same-origin `/api/v1`, credentials 세션, `{data,meta}`/`{error,meta}` **Zod 검증**(HTTP 200이라도 계약 불일치=오류), 401→UNAUTHENTICATED·403→FORBIDDEN·404→NOT_FOUND·네트워크→NETWORK·비JSON→INVALID_RESPONSE·취소→ABORTED, 빈 페이지→empty. 테스트: `tests/frontend-api-http.test.mjs`(9개, `node --experimental-strip-types --test`).

**연결 상태**
| 어댑터 | 실 경로 | 상태 |
|---|---|---|
| `listMyEntries` | GET `/entries?limit=50` (EntrySummary) | ✅ 연결 |
| `getEntryDetail` | GET `/entries/{id}` (EntryDetail) | ✅ 연결 — 마이페이지 접수 상세를 async 서버컴포넌트로. 미존재/미소유=404→notFound() |
| `getEntryAssets` | GET `/entries/{id}/submission` (SubmissionRecord) | ✅ 연결 — **frozen 스냅샷의 assets만**(전부 accepted→`ready` Asset으로 매핑). 초안=스냅샷 없음(404→파일 없음, 오류 아님) |
| `getCompetitionBySlug` | GET `/competitions/{slug}` (Competition) | ✅ 연결 — Leipzig 2027 상세 페이지 async. Apply CTA는 `allowedActions`(start_entry)로만 게이트. 미공개/미존재=404→"준비 중". (**ApplyCta 홈 프리뷰·mypage categoryLabel은 아직 mock — §5**) |
| `getAdminAccess` | GET `/admin/access` (AdminAccess) | ✅ 연결(`ops.ts`) — organizer 플래그 + 공모별 결제권한(viewer/operator). 관리자 surface 게이트. mock=organizer·권한 없음. **화면 배선(관리자 페이지가 이 게이트로 접근제어)은 목록 연결 시 함께 — 목록 갭 때문에 보류(§3)** |
| `listAdminEntries` | GET `/admin/competitions/{id}/entries` | ⏸ **보류(mock 유지)** — 실 `AdminEntry` 계약 갭 때문(§3). 지어내지 않으려면 UI 축소 필요 → 사용자 결정으로 access만 먼저 연결하고 목록은 계약 확장 대기 |
| `createEntry` | POST `/entries` (EntryDetail, 201) | ✅ 어댑터 연결 — Idempotency-Key 필수(같은 키+body=원결과, 재시도 중복생성 방지). mock=draft 픽스처. **UI 소비자 아직 없음**(접수 6단계는 mock 상태머신 `useSubmitFlow` — 실 배선은 제출 UI 재작성 시) |
| `updateEntry` | PATCH `/entries/{id}` (EntryDetail) | ✅ 어댑터 연결 — participant/work/guardian 초안만 저장(서버가 status/price/owner 불변). 저장 실패=오류 유지("저장됨" 금지). mock=현재 draft 반영. **UI 소비자 아직 없음** |
| `getSubmissionReadiness` | GET `/entries/{id}/submission-readiness?locale=` (SubmissionReadiness) | ✅ 어댑터 연결 — 제출 게이트(allowedActions=submit)+policyToken+3동의문서. mock=필수3종+placeholder token. **UI 소비자 아직 없음** |
| `submitEntry` | POST `/entries/{id}/submit` (SubmissionResult) | ✅ 어댑터 연결 — Idempotency-Key 필수, body=SubmitEntryRequest(revision+locale+policyToken+정확히 3동의 accepted). **`submitted`≠접수확정**(결제 필요, blockingReasons). mock=결제대기 submitted. **UI 소비자 아직 없음** |
| `getEntryPaymentOptions` | GET `/entries/{id}/payment-options` (PaymentOptions) | ✅ 어댑터 연결(entry-id aware) — 서버가격 routes+policyToken+money. mock=createReady. **UI 소비자 아직 없음**(PaymentRouting DS는 scenario-mock 유지) |
| `createEntryOrder` | POST `/entries/{id}/orders` (PaymentOrder, 201) | ✅ 어댑터 연결 — Idempotency-Key 필수, body=SelectPaymentRoute(acceptedRefundNotice:true). 같은 키+body=원주문(중복결제 방지), 다른 body=409. 서버가 가격결정(amount/country/merchant 미전송). **주문생성≠결제창**(PG 미연결). mock=주문 픽스처 |
| `getOrder` | GET `/orders/{id}` (PaymentOrder) | ✅ 어댑터 연결 — 주문상태 폴링(check payment/receipt-pending 재조회). success URL 도달≠완료(서버상태가 진실). mock=주문 픽스처 |
| `listEntryUploads` | GET `/entries/{id}/uploads` (Asset[]) | ✅ 어댑터 연결 — **초안 파일 목록(검증 상태 포함)**. §4 갭 해소: 초안 assets 조회 경로 존재(제출 스냅샷 `getEntryAssets`와 별개). mock=asset 픽스처 |
| `createUpload` | POST `/entries/{id}/uploads` (UploadSession, 201) | ✅ 어댑터 연결 — Idempotency-Key 필수, body=UploadRequest(revision+purpose+filename+sizeBytes+mediaType). 응답=asset+새 revision+presigned target+만료. **응답만으로 저장/검증 완료 아님**. mock=target 없는 세션 |
| `completeUpload` | POST `/entries/{id}/uploads/{assetId}/complete` (Asset) | ✅ 어댑터 연결 — 전송완료 통보. 검증은 큐잉(state=validating일 수 있음), **ready는 서버가 결정**. mock=validating asset |
| `removeUpload` | DELETE `/entries/{id}/uploads/{assetId}` ({revision}) | ✅ 어댑터 연결 — body=현재 revision, 응답=새 revision. 고정된 제출 파일은 제거 불가(서버 강제). mock=next revision |
| download/certificates | POST `/certificates/{id}/download`, GET `/entries/{id}/certificates` | ❌ **서버 라우트 미구현** → 연결 불가(NOT_CONNECTED, `listMyCertificates`와 동일). Codex 라우트 추가 필요 |
| httpSend 테스트 | — | ✅ `tests/frontend-api-http.test.mjs` 11개(기존 9 + POST body·Idempotency-Key 검증 + PATCH 키 생략·오류매핑). 제출 mock 픽스처 3종은 상대import 임시스크립트로 계약 refinement 통과 확인 |
| `listMyOrders` | GET `/orders?limit=50` (OrderSummary로 검증) | ⚠️ 연결하되 **item 스키마 미확정**(서버가 PaymentOrder면 VALIDATION_FAILED로 표면화) → Codex 확인 필요 |
| `listMyCertificates` | (없음) | ❌ **GET /certificates(mine) 엔드포인트 없음** → 라이브에서 `NOT_CONNECTED`. Codex에 신규 요청 |

**Codex 확인/보완 필요(계약 차이)**
1. `/orders` 목록 item = OrderSummary인지 PaymentOrder인지 확정(UI는 OrderSummary 필요).
2. **GET /certificates (mine)** 신규 — 마이페이지 인증서 탭 집계용(현재 서버는 entry별만).
3. **관리자 접수 목록(GET `/admin/competitions/{id}/entries`) 계약 갭** — 실 `AdminEntrySchema`는 이제 `workTitle/category/ageGroup` 포함(Codex 반영됨). 그러나 **여전히 없음: `reviewStatus`·`publishedResult`·`fileState`·`certificateIssued`**(mock UI가 렌더하는 4개 컬럼). 또한 **응답에 `total`(총건수) 없음**(cursor 페이지네이션만). **쿼리는 `q`(검색)+`entryStatus`+`cursor`+`limit`만 지원** — mock UI의 **결제 필터·결과 필터·정렬(created/name)** 서버 미지원. payment 형태도 다름(실=`{id,state,money,needsReview,liveMode}`, mock=`{state,amountMinor,needsReview}`). → **결정: 지어내지 않기 위해 `getAdminAccess`만 실 연결하고 목록은 mock 유지.** 목록 실 연결하려면 Codex가 위 4개 컬럼 + total + (결제/결과 필터·정렬)을 계약에 추가하거나, 없으면 UI를 축소(컬럼/필터 숨김)해야 함. `admin/entries/[id]` 상세(`getAdminEntrySync`)도 동일 이유로 mock.
4. ~~초안 assets 조회 경로 없음~~ **해소**: `GET /entries/{id}/uploads`가 초안 파일 목록(Asset[], 검증상태 포함)을 반환함(`listEntryUploads`로 연결). `GET /entries/{id}`(EntryDetail)엔 여전히 assets 미포함이고 제출 스냅샷은 `/submission`이지만, 초안 파일은 uploads 목록으로 조회 가능. 상세 화면은 아직 `getEntryAssets`(제출 스냅샷)만 쓰므로, 초안 파일 표시가 필요하면 `listEntryUploads`로 전환.
5. **상세 화면 공모명·부문 라벨은 아직 mock**: `competitionTitleById`(entry-view)·`categoryLabel`(mypage 상세)·`ApplyCta`(홈 프리뷰)가 mock 공모 픽스처(`getCompetitionSync`) 기반 → live에서 실제 competitionId는 "—", 부문 라벨은 id 그대로. GET `/competitions/{slug}`는 slug 조회라 마이페이지(competitionId만 보유)에서 직접 못 씀 → id→공모 조회 경로(또는 EntrySummary에 공모 타이틀 포함)가 있으면 해소. Leipzig 상세 페이지는 slug로 연결 완료.

**다음 연결 순서**: ~~본인 접수 상세 GET `/entries/{id}` + 제출기록 `/entries/{id}/submission`~~ ✅ · ~~공모 조회·Apply(GET `/competitions/{slug}`)~~ ✅ · ~~관리자 access(GET `/admin/access`)~~ ✅ · ~~쓰기 초안 생명주기(POST `/entries`, PATCH `/entries/{id}`)~~ ✅ · ~~제출(GET submission-readiness + POST submit)~~ ✅ · ~~결제 읽기/생성/폴링(GET payment-options, POST orders, GET orders/{id})~~ ✅ · ~~업로드(GET/POST uploads, complete, DELETE)~~ ✅ · ~~제출 6단계 UI 실 어댑터 배선(dual-mode)~~ ✅. **남은 것**: order confirm/reconcile(PG 콜백 paymentKey 필요·PG 미선정→보류), download/certificates(서버 라우트 미구현→Codex 대기), **live E2E 검증(DB·S3·PG 인프라 필요)**.

## 0-B. 제출 6단계 UI 실 연결 (dual-mode, 2026-09-18)

`submit/page.tsx`를 **dual-mode**로 재작성: `isLive`(NEXT_PUBLIC_API_MODE=live)면 실 어댑터 플로우, 아니면 기존 mock 상태머신(8시나리오 스위처). Rules-of-hooks 때문에 JSX를 프레젠테이션 `SubmitForm`(flow prop)으로 분리하고 wrapper 2개(`MockSubmitInner`=`useSubmitFlow`, `LiveSubmitInner`=`useLiveSubmitFlow`)가 각자 훅 호출.

- **라이브 훅** `src/lib/live/submit-flow.ts` `useLiveSubmitFlow({competition, locale})` — mock과 **동일한 `SubmitFlow` 인터페이스**를 실 어댑터로 구현: 초안 생성(첫 저장 시 lazy `createEntry`)→저장(`updateEntry`, revision 추적)→업로드(`createUpload`+브라우저 presigned PUT+`completeUpload`+`listEntryUploads` 폴링)→제출(`getSubmissionReadiness`→`submitEntry`)→결제(`getEntryPaymentOptions`→`createEntryOrder`→`getOrder` 폴링, 성공 시 `getEntryDetail`로 received 확인). Idempotency-Key는 create/order/upload마다 안정 재사용(중복생성 방지).
- **경계 준수**: 저장 실패=오류(“저장됨” 금지), ready/pageCount/결제/received는 서버 사실, 성공 URL≠완료, 민감데이터 localStorage 금지, 초안은 서버에 남아 재시도 시 유실 없음.
- **`UploadField.onSelect`**를 `(file: File)`로 변경(실 바이트 필요) — mock은 name/size만 사용, 무해.
- **⚠️ 미검증**: 라이브 경로는 tsc·eslint·mock 회귀만 확인. **실 E2E는 DB·S3(presigned)·PG 인프라 필요** → 붙은 뒤 검증. **결제는 PG 미선정이라 실 결제창 없음**(주문 생성 후 폴링만).

---

## 1. 화면 및 라우트 목록

### 참가자(공개/인증)
| 경로 | 유형 | 설명 | 데이터 소스 |
|------|------|------|-----------|
| `/` | 서버 | 홈(레거시 디자인 + Leipzig 접수 CTA 밴드) | mock/정적 |
| `/contests` | 클라 | 공모 목록 | **정적 샘플**(site-data) ⚠️§8 |
| `/contests/[slug]` | 서버 | 공모 상세(레거시) | 정적 샘플 |
| `/contests/leipzig-2027` | 서버 | **Leipzig 2027 상세**(실 첫출시) | `leipzig-detail.ts` |
| `/submit` | 클라 | 작품 접수 6단계 | mock `useSubmitFlow` |
| `/mypage` | 클라 | My GYCA(내 접수/결과/결제/인증서/개인정보) | mock 어댑터 |
| `/mypage/entries/[id]` | 서버 | 접수 상세(제출내용·파일·동의·본선) | mock 어댑터 |
| `/mypage/entries/[id]/payment` | 서버+클라 | 결제 확인 | mock 어댑터 |
| `/archive/klimt-villa` | 서버 | 클림트 빌라 **아카이브**(모집 아님) | `klimt-villa.ts` |
| `/exhibitions`, `/winners`, `/notices`, `/about` | 혼합 | 레거시 공개 콘텐츠 | **정적 샘플** ⚠️§8 |
| `/login`, `/signup`, `/settings`, `/signout` | - | better-auth(실제) | 실서버 |

### 관리자(운영, KO 전용)
| 경로 | 유형 | 설명 |
|------|------|------|
| `/admin` | 클라 | 접수 관리(검색·필터·정렬·페이지·선택·일괄·CSV) |
| `/admin/entries/[id]` | 서버 | 접수 상세(참가자·작품·파일검증·결제[읽기]·동의·처리이력·허용작업) |

### 심사위원(블라인드, KO 전용)
| 경로 | 유형 | 설명 |
|------|------|------|
| `/judge` | 클라 | 배정 작품(블라인드 데이터 타입) |
| `/judge/review/[id]` | 서버+클라 | 심사(PDF·항목별 점수·코멘트·임시저장·제출) |

---

## 2. 변경 파일과 공통 컴포넌트

### 어댑터·데이터(mock — 실연결 교체 지점)
- `src/lib/api/index.ts` — 참가자 어댑터(RequestState, listMyEntries/Orders/Certificates, getEntry(Detail)ById, getEntryAssets/WorkTitle/CertState, createOrder 등)
- `src/lib/api/ops.ts` — **관리자·심사 어댑터**(listAdminEntries, getAdminEntry, bulkPublishResult, bulkIssueCertificates, requestCsvExport / listJudgeAssignments, getReviewContext, saveReviewDraft, submitReview)
- `src/lib/mock/fixtures.ts`, `src/lib/mock/submit-machine.ts` — 픽스처·접수 상태머신
- `src/lib/entry-view.ts` — 표시 파생(상태 라벨·결제 라벨·오류 현지화 errorText 등, 서버 사실에서 표시만 도출)
- `src/contracts/*` — **Codex 소유** 계약(재선언·수정 안 함)

### 화면
- 참가자: `src/app/(site)/mypage/**`, `submit/page.tsx`, `contests/leipzig-2027/page.tsx`, `archive/klimt-villa/page.tsx`
- 관리자/심사: `src/app/(site)/admin/**`, `src/app/(site)/judge/**`
- 컴포넌트: `src/components/mypage/PaymentConfirm.tsx`, `src/components/judge/ReviewEditor.tsx`, `src/components/submit/*`

### 공통 컴포넌트(디자인 시스템 — 재사용)
`src/components/ds/`: `Button`, `Message`/`StatusBadge`(tone), `Field`/`TextInput`/`Textarea`/`Select`, `Tabs`, `Stepper`, `Modal`(radix, 접근성), `PaymentRouting`(mock 주문 생성). 사이트: `PageHeader`, `EditorialHeader`, i18n `LocaleProvider`/`useLocale`.

---

## 3. API별 요청·응답 타입

전체 표는 제안 문서에 있음. 요약:
- **참가자 접수/결제**: [submit-flow-contract-proposal.md §2](./submit-flow-contract-proposal.md) — POST `/entries`, PATCH `/entries/{id}`, uploads, GET readiness, POST `/submit`, POST `/checkout`, GET `/orders/{id}`. 타입은 `src/contracts/*`(EntrySummary/EntryDetail/Asset/Order/Certificate/SubmissionReadiness/SubmissionResult/PaymentOrder).
- **My GYCA 갭**: 같은 문서 §6-b(항목 9–13) — `EntrySummary.workTitle`, EntryDetail assets/consents, 인증서 lifecycle state, finals €1,100.
- **관리자 A1–A8 / 심사 J1–J6**: [admin-judge-contract-proposal.md §A.2 / §B.2](./admin-judge-contract-proposal.md). 신규 타입(제안): `AdminEntryView`(+workTitle/reviewStatus/publishedResult/category/ageGroup/fileState/certificateIssued/allowedActions 확장), `AdminEntryDetail`, `BulkOutcome{requested,succeeded[],failed[{id,reason}]}`, `AuditEvent`, `JudgeAssignment`(블라인드), `ReviewContext`, `RubricCriterion`, `ReviewDraft`. 현재 shape는 `src/lib/api/ops.ts` 참고(계약 확정 시 대체).

---

## 4. 상태별 화면 동작

| 상태 | 동작 |
|------|------|
| 로딩 | 스켈레톤/텍스트, sr-only status |
| 빈 | 전용 빈 상태 + CTA(예: "공모 자세히 보기") |
| 오류 | `Message` + retryable면 "다시 시도"; 오류 문구는 code→현지화(errorText) 후 fallback |
| 권한 없음(403) | 관리자/심사 "접근 권한이 없습니다" |
| 저장 실패 | "저장됨" 절대 표시 안 함(SaveBadge/심사 임시저장) |
| 동시 수정 충돌 | `REVISION_CONFLICT` → 자동 덮어쓰기 금지, "최신 내용 불러오기" |
| 일괄 부분 실패 | 성공/실패 분리(요청 N · 성공 X · 실패 Y + 사유) |
| 결제 | 8상태(가능/이동중/승인확인/대기/실패/완료/접수확정확인중/마감) — 성공 URL 도착≠완료, 서버 재조회 |
| 접수 완료 | 서버 `received`+접수번호일 때만 결과 표시. 이메일 실패≠접수 실패 |

원칙: 버튼·권한·마감은 **서버 `allowedActions`/`blockingReasons`로만** 구동. 화면에서 파생 판단 안 함.

---

## 5. 필요한 오류 코드(프런트가 EN/KO 문구 소유)

계약 `ERROR_CODES`(src/contracts/index.ts): `UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, ENTRY_LOCKED, DEADLINE_PASSED, NOT_OPEN_YET, COMPETITION_ARCHIVED, FILE_NOT_READY, VALIDATION_FAILED, CONSENT_REQUIRED, GUARDIAN_VERIFICATION_REQUIRED, FILE_TOO_LARGE, RATE_LIMITED, PAYMENT_UNAVAILABLE, POLICY_NOT_CONFIGURED, INTERNAL_ERROR, STORAGE_UNAVAILABLE, UPLOAD_EXPIRED, UPLOAD_LIMIT_REACHED`.
- `BLOCKING_REASONS`: `NOT_OPEN_YET, DEADLINE_PASSED, COMPETITION_ARCHIVED, POLICY_NOT_CONFIGURED, PAYMENT_UNAVAILABLE, ENTRY_LOCKED, REQUIRED_FIELDS_MISSING, FILE_NOT_READY, CONSENT_REQUIRED, GUARDIAN_VERIFICATION_REQUIRED, PAYMENT_REQUIRED, PAYMENT_PENDING, RECEIPT_PENDING`.
- `REJECTION_CODES`: `FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, CONTENT_TYPE_MISMATCH, FILE_CORRUPTED, PDF_ENCRYPTED, PDF_TOO_FEW_PAGES, FILE_UNSAFE`.
- 현재 프런트 현지화 매핑: `entry-view.errorText`(RATE_LIMITED/INTERNAL_ERROR/NOT_FOUND/VALIDATION_FAILED/CONSENT_REQUIRED/IDEMPOTENCY_CONFLICT). **관리자·심사 신규 코드**(예: 결과 이미 확정, 발급 대상 아님)는 §admin-judge 확정 시 카탈로그 추가.

---

## 6. mock 제거 및 실제 API 연결 지점

교체 대상(모두 `RequestState` 반환 → fetch로 교체, 화면 수정 최소):
1. `src/lib/api/index.ts` — 참가자 목록/상세/결제/인증서. `createOrder`/`getPaymentOptions`는 실 PG/checkout으로.
2. `src/lib/api/ops.ts` — 관리자/심사 전부. 일괄 POST는 `actionId`(멱등키) 유지.
3. `src/lib/mock/submit-machine.ts` — 접수 6단계 상태머신 → 실 PATCH/upload/submit/checkout/reconcile.
4. `src/lib/mock/fixtures.ts` 및 `RAW_ENTRY_EXTRA/RAW_ENTRY_ASSETS/RAW_CERT_STATE` — 서버 응답으로 대체.
남기는 것: `src/lib/entry-view.ts`(표시 파생), `src/components/ds/*`, 화면 컴포넌트(어댑터 시그니처만 맞추면 유지).
연결 전제: 계약(§3)·오류 코드(§5)·역할/권한(admin/judge) 확정. 공개 콘텐츠(§8)의 CMS/정적 소유 결정.

---

## 7. 미결정 정책(정의 필요)

frontend-notes Q1–Q6 + 이번 추가:
- Q1 마감 정확 시각·결제 유예. Q2 보호자 확인 방식(체크박스 vs 이메일). Q3 본선 확정/€1,100 주문. Q4 **공개 콘텐츠 소유(winners/exhibitions/news/klimt = 정적 vs CMS)** ← §8 핵심. Q5 상세 본문 소유. Q6 참가자 필드(nameEn/grade/ageGroup 산정).
- 접수 §6: 영문 필수 플래그, 첫 출시 필수 업로드 항목, maxBytes/minPages, reconcile 제한.
- 관리자/심사: AdminEntry 필드 확장, 인증서 lifecycle state 모델링, 심사 배점 설정(J5) 확정값, 역할 모델(better-auth admin/judge), 블라인드 파일명·PDF 식별정보 제거(서버).

---

## 8. 검증 결과와 남은 문제

### 실행한 검사(2026-09-17)
| 검사 | 결과 |
|------|------|
| `npx tsc --noEmit` | **통과**(0 오류) |
| `npx eslint`(변경 파일) | **통과**(0 오류) |
| `npx next build`(프로덕션) | **완료 못 함** — Turbopack 패닉: `@pdf-lib/standard-fonts`의 `pako` 파일 읽기 중 Windows `os error 5`(액세스 거부). **코드 오류 아님**(에셋 emit 단계의 node_modules 파일락/권한). tsc·eslint·dev 런타임은 정상 |
| dev 런타임 수동 검증 | mypage/submit/admin/judge 흐름·상태 브라우저 확인 |

### 실행하지 못한 검사(사유)
- **프로덕션 빌드 산출물**: 위 Turbopack 파일 접근 오류로 미완(환경 이슈, `pnpm rebuild`/권한/webpack 폴백 또는 다른 머신 필요).
- **실제 결제·접수 종단 검증**: 서버·PG·DB 미연결(전 구간 mock). 빌드/타입 통과가 결제·접수 동작을 보장하지 않음. **결제·접수는 검증되지 않음**(Codex 연결 후 검증 필요).
- **자동 테스트**: 프런트 테스트 스위트 없음(package.json에 test 스크립트 없음).
- **실 로그인 플로우**: 자격증명 없어 better-auth 로그인 후 상태는 미검증.

### 남은 문제
- **[P1 → 안전 처리 완료, CMS 연결 남음]** 공개 콘텐츠(`/contests`·`/exhibitions`·`/winners`·`/notices`)는 `site-data.ts` 정적 샘플. **사용자 결정: "공개하되 안전 처리".** 조치(2026-09-17):
  - `site-data.ts`에 **실 Leipzig 2027 공모** 추가(유일한 "접수 중", `/contests/leipzig-2027` 전용 라우트로 링크). 기존 4건은 `sample:true` 플래그.
  - `/contests` 목록·상세: 샘플은 "샘플·준비 중" 배지 + **Apply/`/submit` CTA 제거**(상세는 "실제 접수: Leipzig 2027"로 유도). 페이지 안내 배너.
  - `/winners`: 배너 + 수상 배지마다 "예시/Sample" 마커. `/exhibitions`·`/notices`: 배너(+ 전시 "예시·준비 중" 마커).
  - 홈: EventSlider=실 Leipzig+"Coming Soon"만, PartnerMarquee=역할 라벨+"확정 후 공개" — 이미 안전.
  - **남은 것**: 실제 콘텐츠/CMS 연결(Q4). 그전까지 샘플은 위 마커로 노출 유지.
- **[확인됨·안전] 클림트 빌라**: 모집 아님(공모 목록 미포함, 아카이브 페이지에 접수/apply 링크 없음). ✅
- **[확인됨·안전] Leipzig 전시·본선**: 상세·홈 모두 "준비 중/승인 대기(pending)"로 표기, 미승인 장소·로고 미노출, €70만(₩ 없음), 본선 €1,100은 표시 전용. ✅
- **[주의] i18n**: 관리자·심사 화면과 `ops.ts` 오류 문구는 **KO 전용**(운영 도구 — 의도). 참가자 화면은 EN/KO. 고유명사(Official Selection/Leipzig Finalist)는 EN 유지.
- **[주의] 새로고침**: 접수 6단계 진행 상태는 in-memory mock이라 새로고침 시 초기화(실 구현은 서버 draft에서 이어쓰기 — resume 시나리오로 시연). 상세/목록은 서버/재조회로 복원. 로케일은 쿠키 유지.
- **[정보] 모바일**: 관리자·심사 표는 `overflow-x-auto`로 가로 스크롤(의도). 카드/칩은 wrap. mypage·상세 375px 확인.

### Codex 점검(2026-09-17) 대응
Codex 프런트 점검 7개 항목 중 **프런트만으로 가능한 정직성 수정 3건 완료**:
- **#2 홈 Apply CTA**: `ApplyCta.tsx` — canApply 시 "※ 데모 화면… 실제 접수 가능 여부는 서버 연결 후 확정" 주석 추가(이미 allowedActions 구동).
- **#3 접수 저장 안내**: `submit/page.tsx` — "현재는 데모이며 서버 저장 미연결(새로고침 시 초기화)…"로 문구 수정. (겸사 pre-existing lint 오류 `set-state-in-effect` 제거: result 스텝을 effect setState 대신 파생값 `uiStep`으로.)
- **#5 공개 콘텐츠 링크·사업자 정보**: `Footer.tsx` — CEO/사업자번호/통신판매/호스팅 "준비 중", 가짜 "Gildong Hong"·"…-0000" 제거, 이메일 mailto, SNS 준비 중 플레이스홀더. `NewsUpdate.tsx`·`SectionHeading.tsx` — `#` 죽은 링크 → 실제 목적지(뉴스=Leipzig 상세, 전체보기=/notices). 홈 `#` 링크 0개 확인.

나머지 4건은 **서버/통합 대기**(#1 실 API 연결, #4 심사 PDF·블라인드 파일 접근·PDF 식별정보 제거[서버], #6 아카이브 실자료, #7 최신 계약 기준 어댑터 연결 순서). tsc+eslint 0.

> 요약: **빌드 통과만으로 실제 결제·접수가 검증됐다고 보지 않는다.** 코드 레벨(타입·린트)·UI 동작은 확인, 결제·접수·실 로그인·프로덕션 빌드는 미검증(사유 위). 출시 전 P1 공개 콘텐츠(안전 처리 완료, CMS 연결 남음)와 위 서버/통합 4건을 처리해야 함.
