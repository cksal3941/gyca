# Leipzig 2027 접수 화면 — Codex 합의용 API·상태·필드 목록 (구현 전)

목적: 접수(작품 제출) 화면을 구현하기 **전에**, Codex와 합의·확정·삭제(덜어내기)할
**API / 상태 / 필드**를 한 곳에 정리한다. 대부분은 이미 `src/contracts/*`와
`docs/backend/api-contract.md`에 정의돼 있으므로, 여기서는 그 계약을 6단계 UI에 매핑하고
**결정이 필요한 지점만** 표시한다. (이 문서는 제안이며, 최종은 Codex 자료와 대조 후 확정.)

담당 경계: **DB·인증·결제 승인·웹훅·저장소 권한·서버 API·PG SDK = Codex.**
프런트는 화면·상태표시·서버가 준 `allowedActions`/`blockingReasons` 기반 게이팅·mock만 담당.
현재 접수/업로드/결제 관련 **실 API 연결은 0** — 전부 mock 어댑터(`src/lib/api`)+픽스처.

---

## 1. 전체 흐름 & "폼 내부 단계" 구분

기획서의 로그인·마이페이지까지 포함한 전체 흐름과, 폼 내부 6단계를 구분한다.

```
[전체 흐름]
로그인(better-auth, 실제) 
  → 마이페이지(내 접수 목록)          GET /entries
  → 공모 상세 "작품 접수"(start_entry) POST /entries        (초안 생성)
  → ┌───────────── 접수 폼 (내부 6단계) ─────────────┐
    │ 1 참가자·보호자 정보   PATCH /entries/{id}        │
    │ 2 작품 정보           PATCH /entries/{id}        │
    │ 3 파일·필수 자료       POST/DELETE .../uploads     │
    │ 4 입력 확인·동의       GET readiness → POST submit │  ← 여기서 entry=submitted
    │ 5 결제                POST checkout → GET order   │  ← submit 이후 결제
    │ 6 접수 결과           GET /entries/{id} (received) │
    └────────────────────────────────────────────────┘
```

핵심 순서(계약이 강제): **제출(submit)이 결제보다 먼저**다. `/submit` 응답
(`SubmissionResultSchema`)의 `entryStatus="submitted"` + `blockingReasons`에
`PAYMENT_REQUIRED`가 오고, 그 다음 결제 단계로 넘어간다. 라이프사이클:
`draft → submitted → received`(결제 성공 + 서버 확정 시에만 received, 이때만 접수번호 발급).

폼 단계 번호(1–6)는 UI 진행 표시용이며, 서버 상태(`entryStatus`)와는 별개다.

---

## 2. API (엔드포인트) — 단계별 사용처

전부 `docs/backend/api-contract.md`에 이미 명세됨. **신규 요청 없음**, 확정만 필요.

| # | 단계 | 메서드/경로 | 요청 | 응답(계약) | 상태 |
|---|------|------------|------|-----------|------|
| A | 진입 | `POST /entries` | `{competitionId}` | EntryDetail(draft) | 계약됨(구현됨) |
| A | 마이페이지 | `GET /entries` `GET /entries/{id}` | cursor/limit / id | EntrySummary / EntryDetail | 계약됨(구현됨) |
| 1·2 | 정보 저장 | `PATCH /entries/{id}` | revision + participant/work/guardian 초안 | EntryDetail(+revision) | 계약됨(구현됨) |
| 3 | 업로드 시작 | `POST /entries/{id}/uploads` | `{revision,purpose,filename,sizeBytes,mediaType}` | UploadSession(전송 URL·만료) | 계약됨(미구현) |
| 3 | 업로드 완료 | `POST .../uploads/{assetId}/complete` | 완료 참조 | Asset(state=validating…) | 계약됨(미구현) |
| 3 | 교체/삭제 | `DELETE .../uploads/{assetId}` | `{revision}` | — | 계약됨(미구현) |
| 4 | 동의 준비 | `GET /entries/{id}` (submission readiness) | id | SubmissionReadiness(동의 문서·요구) | 계약됨(미구현) |
| 4 | 제출 | `POST /entries/{id}/submit` | `{revision,locale,policyToken,consents[3]}` | SubmissionResult(submitted) | 계약됨(미구현) |
| 5 | 결제 생성 | `POST /entries/{id}/checkout` | `{returnPath}` + Idempotency-Key | 주문(서버 가격) | 계약됨(미구현) |
| 5 | 상태 재확인 | `POST /orders/{id}/reconcile` | id (제한 횟수) | 갱신된 주문 상태 | 계약됨(미구현) |
| 5·6 | 주문 조회 | `GET /orders/{id}` | id | 결제·접수확정 상태 | 계약됨(미구현) |
| 6 | 접수 결과 | `GET /entries/{id}` | id | EntrySummary(received+receiptNumber) | 계약됨(구현됨) |

규칙(계약 준수): `returnPath`는 **내부 경로만**. 생성형 POST(checkout 등)는
`Idempotency-Key` 필수(재시도 시 같은 키 재사용 → 중복 결제/유실 방지). **성공 URL 도착만으로
완료 표시 금지** → 반드시 `GET /orders/{id}` + `GET /entries/{id}`로 서버 최종 상태 조회.

---

## 3. 상태 (states) — 화면이 구분할 것

### 3.1 임시저장 (1·2단계, 클라이언트 요청 상태)
`PATCH` 를 감싸는 `RequestState`로 표현. **서버 enum 아님.**
- `임시저장 중`(요청 진행) / `저장 완료`(성공 응답의 `revision`으로 갱신) / `저장 실패`(에러)
- **저장 실패 시 "저장됨" 표시 절대 금지.** 성공 응답 수신 전에는 미저장으로 취급.
- `409 REVISION_CONFLICT` → 자동 덮어쓰기 금지, 서버 최신본 재조회 후 사용자 확인.

### 3.2 업로드 (3단계) — `Asset.state` (서버) + 클라 전송 상태
- 서버 `Asset.state`: `pending_upload → uploaded → validating → ready | rejected`
- `rejectionCode`(서버): `FILE_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE, CONTENT_TYPE_MISMATCH, FILE_CORRUPTED, PDF_ENCRYPTED, PDF_TOO_FEW_PAGES, FILE_UNSAFE`
- 클라 전송 상태: `업로드 중`(진행률) / `업로드 완료` / `검증 중`(=validating) / `검증 실패`(=rejected)
- 파일명·용량·진행률 표시. **PDF 페이지 수는 서버 `Asset.pageCount`만 표시.**
- 프런트 사전검사(확장자/용량)는 편의일 뿐, **최종 검증 아님** — 서버 state가 최종.
- 중단·재시도·교체·삭제 UX 제공.

### 3.3 동의 (4단계) — 서버가 요구를 반환
- `SubmissionReadiness.documents`: `ConsentDocument{kind,version,locale,title,text}`
  - `kind ∈ {participation_rules, privacy, work_license}` (계약상 **정확히 3개**)
- 보호자: `EntrySummary.guardianVerification{method: not_configured|checkbox|email, status: not_required|required|pending|verified|failed|expired}`
- **국적으로 보호자 요구를 하드코딩하지 않음** → 서버가 준 `guardianVerification.status`/blocking으로 표시.
- ⚠️ 기획서의 "선택 홍보 동의"는 **현 계약에 없음**(consents는 3개 고정). → §6 결정 필요.

### 3.4 결제 (5단계) — 기획서 8상태 ↔ 계약 매핑

| 기획서 화면 상태 | 계약 근거 |
|---|---|
| 결제 가능 | `entry.allowedActions ∋ start_payment` |
| 결제창 이동 중 | 클라 전이(checkout 생성 후 이동) — *PG 미연동* |
| 승인 확인 중 | 반환 후 `GET /orders/{id}`·`reconcile`, `payment.state=pending` |
| 결제 대기 | `payment.state=pending` / `blockingReasons ∋ PAYMENT_PENDING` |
| 결제 실패 | `payment.state=failed` |
| 결제 완료 | `payment.state=succeeded` |
| 결제됐으나 접수 확정 확인 중 | `payment.state=succeeded` + `entry≠received` + `blockingReasons ∋ RECEIPT_PENDING` |
| 마감으로 진행 불가 | `DEADLINE_PASSED` / `paymentClosesAtExclusive` 경과 |

- 참가비는 **서버 제공 금액·통화(`Money{amountMinor,currency:"EUR"}`)로만** 표시(하드코딩 금지).
- 재시도 중 기존 작품 정보·업로드 유실 금지. 유예/마감 후 재시도 가능 여부는 서버 정책.

### 3.5 접수 완료 (6단계)
- **서버가 `entryStatus="received"` + `receiptNumber` + `receivedAt` + `payment.state="succeeded"`를
  확인한 경우에만** 접수번호·공모명·작품명·결제내역·접수 시각 표시.
- 확인 이메일 발송 실패 ≠ 접수 실패 (별개 표시). 발송 실패해도 접수 자체는 유효.

---

## 4. 필드 목록 — 필수/선택은 **서버 FormSpec이 주도**

`Competition.formSpec`(서버)이 필드/업로드의 `requiredOnSubmit`, 카테고리, 연령그룹,
`ageReferenceDate`, 업로드 `maxBytes`/`minPages`를 **모두 제공**한다. 프런트는 이를 렌더할 뿐
필수 여부·용량을 임의 확정하지 않는다(계약이 `requiredOnSubmit=null`/`maxBytes=null`이면
"미확정"으로 강제).

| 그룹 | 필드(`FORM_FIELD_PATHS`) | 비고 |
|---|---|---|
| participant | name, nameEn, dateOfBirth, residenceCountry, nationality, school, grade | 필수/공개 범위 서버 결정 |
| guardian | name, email | 보호자 요구 정책과 함께 확정 |
| work | title, description, **englishTitle**, **englishDescription**, creatorBio, category, language, publicationStatus | 영문 작품명·소개 **필수**(요구) |
| uploads(`ASSET_PURPOSES`) | cover_image(1), book_pdf(20쪽+), copyright_declaration, guardian_consent, publisher_permission | 어떤 게 필수인지 FormSpec로 |

초안 저장 스키마: `ParticipantDraftSchema`/`WorkDraftSchema`(모두 optional — 초안 단계 누락 허용,
제출 단계에서 서버가 필수 검사). 입력값 유지·이전 단계 이동은 서버 EntryDetail을 단일 소스로.

**민감정보/localStorage:** 지원서 필드값을 localStorage에 저장하지 않는다. 재소스는 서버
(`GET /entries/{id}`)이며, 새로고침·재로그인 후 서버에서 이어쓰기. 클라이언트에는 **비민감 포인터만**
(예: URL 쿼리의 `entryId`·현재 step index) 보관 제안 — 값 자체는 저장 안 함(§6 확인).

---

## 5. Mock 재현 시나리오 (완료 기준) — 프런트 담당(픽스처 확장)

정상 흐름 외 아래를 mock으로 재현. 전부 Claude 소유 mock(`src/lib/mock/fixtures.ts` 확장),
Codex 서버 불필요.

| 시나리오 | 재현 방식 |
|---|---|
| 임시저장 실패 | PATCH가 `RATE_LIMITED`/`INTERNAL_ERROR`/`REVISION_CONFLICT` 반환 |
| PDF 검증 실패 | `Asset.state=rejected` + `PDF_TOO_FEW_PAGES`/`PDF_ENCRYPTED` |
| 업로드 중단 | 전송 진행 중 abort → 재시도/교체 |
| 결제 취소 | `payment.state=cancelled` |
| 승인 지연 | `payment.state=pending`(reconcile 여전히 대기) |
| 결제완료 후 접수확인 지연 | `payment.state=succeeded` + `blockingReasons ∋ RECEIPT_PENDING`(아직 received 아님) |
| 마감 이후 접속 | competition/entry `blockingReasons ∋ DEADLINE_PASSED` |
| 재접속 후 이어쓰기 | `GET /entries/{id}` 가 저장된 필드+revision 가진 draft 반환 |

---

## 6. ★ Codex와 합의·확정·"덜어낼" 항목 (여기서 결정)

1. **동의 항목 — [Codex 확정].** 실제 제출엔 **필수 3종만**(`participation_rules`/`privacy`/`work_license`)
   연결 + 보호자 확인은 별도 절차 유지. 선택 동의는 **데이터 주도**로 준비하되 데이터 없으면
   제목·체크박스·빈 공간 **모두 미표시**. 현재 API에 임의 marketing 동의를 보내거나 3종 목록에 추가하지 않음.
   '풀 버전' mock에서만 선택 동의를 **"미구현 시연"으로 구분**해 시연하고, 첫 출시 fixture·실 어댑터에서는 제외.
   '홍보 동의' 의미 구분: (a) 작품을 전시·출판·홍보에 사용하는 허락 → 기존 `work_license` 범위,
   (b) 참가자에게 마케팅 이메일 발송 동의 → 별도 선택 동의(필요 시 목적·채널·문구·철회·미성년자 기준 확정 후
   Codex가 저장 이력+API 계약 추가; **미동의가 접수·결제를 막지 않도록** 설계).
   ⚠️ 풀 버전의 필드·업로드 규격도 현재 서버가 모두 지원한다고 가정하지 않음(시연 항목 구분).
2. **영문 작품명·소개 필수화 확정.** FormSpec에서 `work.englishTitle`·`work.englishDescription`의
   `requiredOnSubmit=true`로 오는지 확정.
3. **보호자 요구 소스.** 연령/정책 기반으로 서버가 `guardianVerification.status=required`를
   반환한다는 것 확정(프런트는 국적 하드코딩 안 함).
4. **첫 출시 업로드 필수 항목(덜어내기 후보).** `copyright_declaration`/`guardian_consent`/
   `publisher_permission` 중 라이프치히 첫 출시에 실제 필수인 것만 남김. FormSpec `uploads[].requiredOnSubmit`로.
5. **용량·페이지 실제 설정값.** `maxBytes`(표지/PDF), `book_pdf.minPages=20` 등 라이프치히 설정값 제공.
6. **폼 필드 축소(덜어내기 후보).** participant `school/grade/nationality`, work `creatorBio/publicationStatus`
   가 첫 출시에 필요한지 — 불필요하면 FormSpec에서 제외해 폼 단축.
7. **결제/PG 경계.** PG 미선정·checkout이 주문만 만들고 실제 승인·콜백·웹훅 미연동임을 확정.
   `reconcile` 재시도 제한·유예·마감 후 재시도 정책값 제공(표시용).
8. **클라 보관 허용 범위.** URL의 `entryId`+step만 보관하고 지원서 값은 저장 안 하는 방침 확인.

---

## 6-b. My GYCA(참가자 대시보드) 구현 중 발견한 계약 갭 — Codex 확정 필요

참가자용 My GYCA 목록/상세/결과/인증서/본선 화면 구현 시 아래 필드가 계약에 없어
**mock으로 임시 채움**(클리어 라벨). 실 연결 전 Codex가 계약에 반영해야 한다.

| # | 갭 | 현재 mock 대응 | 요청 |
|---|-----|--------------|------|
| 9 | **`EntrySummary.workTitle` 없음** — 목록에 작품명 표시 불가 | `getEntryWorkTitle(id)`가 draft 픽스처의 `work.englishTitle`를 조인 | EntrySummary에 `workTitle`(또는 대표 표시명) 추가 |
| 10 | **접수 상세의 제출 파일 목록** — EntryDetail에 assets 미포함 | `getEntryAssetsSync(id)`가 별도 `Asset[]` 픽스처 반환(계약 AssetSchema로 검증) | 상세 조회에 assets 포함 여부/페이지네이션 확정 |
| 11 | **동의 내역(수락 이력)** — EntryDetail에 consents 미포함 | 제출/접수 상태면 필수 3종 "동의함"으로 표시(mock) | 제출 시 수락한 consent kind/version/시각 반환 |
| 12 | **인증서 라이프사이클 상태** — CertificateSummary에 상태 없음 | `getCertState(id)`(issued/pending/reissuing/error) mock 맵 | 발급대기/재발급/오류 상태 모델링 or "다운로드 가능"만 유지 결정 |
| 13 | **본선(finals) €1,100 결제** — 계약 `finalParticipation`은 표시 필드뿐 | 본선 영역은 표시 전용(초청/확정 라벨), 결제 버튼 비활성 | 별도 요청 시 finals checkout 계약 추가 |

원칙 유지: 위 mock은 전부 클라 표시용이며 실 어댑터·서버 확정 후 교체. 화면은 서버가 준
`allowedActions`/상태만 신뢰하고 권한·마감을 자체 판단하지 않는다.

---

## 7. 실제 API 연결 여부 (지금)

| 영역 | 상태 |
|---|---|
| better-auth 로그인/세션 | **실제 연결됨**(기존) |
| 공모 조회 GET | 서버 구현됨 — 단, 프런트는 아직 **mock 어댑터** 사용 |
| 접수 초안 POST/GET/PATCH | 서버 구현됨 — 프런트는 **mock** |
| 업로드/제출/결제/주문 | 서버 **미구현** + 프런트 **mock** |
| PG SDK·실 결제 승인·웹훅 | **미연동**(Codex 담당) |

→ 이번 구현은 **전 구간 mock**(픽스처+어댑터, 네트워크 없음)으로 만들고, "실제 연결됨"으로 표기하지
않는다. 실 연결은 Codex 서버·PG 확정 후 어댑터만 교체.
