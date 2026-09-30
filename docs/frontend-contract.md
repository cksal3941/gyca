# GYCA 프런트 ↔ 서버 데이터 계약 (제안 v0.1)

> ⚠️ **갱신 안내 (2026-09-15):** Codex의 `docs/backend/` 초안 검토 후, 아래 §2 단일 심사 상태 enum과 §3 `Money.amount` 표기는 **`docs/frontend-notes-for-backend.md` 기준으로 대체**되었다. 최종은 상태 3축(`entryStatus`/`reviewStatus`/`publishedResult`) + `amountMinor` + `allowedActions` 구동을 따른다. 이 문서의 나머지(화면 필드·서버 재검증 표·어댑터 경계)는 유효.

> 상태: **제안 (Codex 합의 전)**. 이 문서는 프런트가 mock으로 먼저 구현하기 위한 타입·어댑터 경계를 제안한다.
> 실제 필드명·엔드포인트·검증 위치는 Codex와 합의 후 확정한다. 합의 전까지 프런트는 `src/lib/mock/`으로만 구현하며 "실제 연결"로 표기하지 않는다.
>
> 근거 문서: `GYCA_Leipzig_2027_UIUX_기획서.docx`(2026.09, v1.0) — 첫 출시 기준.
> 구 설계서 `GYCA_Website_UX_Screen_Flow_Guide.docx`(2026.08.24)와 충돌 시 **Leipzig 문서 우선**.

---

## 0. 원칙

- **상태 3종 분리** (사용자 요구): 공모전 진행 상태 / 개별 출품 심사 상태 / 결제 상태는 서로 다른 축이며 별도 enum으로 둔다. 서로를 파생하지 않고 독립 저장한다.
- **통화**: 첫 출시는 `EUR` 단독. 금액은 정수 센트가 아니라 `{ currency: "EUR", amount: 70 }` 형태로 전달하되, 표기는 `€70`.
- **서버 재검증 필수 항목**은 §5에 별도 표기. 클라이언트 검증은 UX 보조일 뿐 신뢰 경계가 아니다.
- **미확정(TBD)** 값은 임의 생성하지 않는다. 타입에 `| null`로 두고 UI는 "미정" 상태를 노출한다.

---

## 1. 공모전 진행 상태 — `ContestStatus`

공모전(대회) 자체의 생애주기. 화면: 홈 카드, 공모전 목록/상세의 상태 배지.

```ts
type ContestStatus =
  | "upcoming"   // 접수 예정 (공고 전/오픈 전)
  | "open"       // 접수 중
  | "closed"     // 접수 마감 (심사 전)
  | "judging"    // 심사 중
  | "result"     // 결과 발표
  | "archived";  // 완료·아카이브 (예: Klimt Villa — 신규 모집 아님)
```

- Klimt Villa는 항상 `archived`로 취급하고 Apply/Submit CTA를 노출하지 않는다.
- 다장르 샘플 공모는 첫 출시 화면에서 **숨김**(데이터 유지). 상태값 삭제 아님.

---

## 2. 개별 출품 심사 상태 — `EntryReviewStatus`

한 건의 출품(Entry)이 접수·심사·결과 축에서 갖는 상태. **결제·통화와 무관.**
Leipzig 기획서 §6·§9 근거.

```ts
type EntryReviewStatus =
  | "draft"                 // 작성 중 (임시저장)
  | "submitted"            // 접수 완료 (결제 성공 후 확정)
  | "under_review"         // 심사 중
  | "official_selection"   // Official Selection — 1차 국제심사 통과 (인증서 대상)
  | "finalist"             // Leipzig Finalist — Official Selection 중 최대 30작품
  | "not_selected"         // 미선정 (과도한 실패 표현 지양, "심사 완료" 톤)
  | "exhibition_confirmed"; // 본선(전시) 참가 확정
```

- `submitted`로의 전환은 **결제 성공이 전제** (§3 참조). 프런트는 두 상태를 각각 읽되, 전환 판단은 서버 권한.
- 인증서 다운로드 노출 조건: `official_selection` 또는 `finalist` 이상 (§4 Certificate).
- 구 설계서의 한글 상태(임시저장/접수완료/심사중/본선진출/최종수상)는 이 enum으로 **매핑만** 하고 화면 라벨은 i18n으로 처리.

---

## 3. 결제 상태 — `PaymentStatus`

출품 건에 붙는 결제의 상태. **심사 상태와 독립.**

```ts
type PaymentStatus =
  | "required"   // 결제 필요 (미결제)
  | "pending"    // 결제 진행/승인 대기
  | "paid"       // 결제 완료 (€70)
  | "failed"     // 결제 실패 (재시도 안내)
  | "refunded";  // 환불 완료

type Money = { currency: "EUR"; amount: number }; // 첫 출시: 항상 EUR
```

- 결제 승인·웹훅·영수증 발급은 **Codex 담당**. 프런트는 상태 표시와 재시도 진입만.
- 환불 규정 텍스트는 CMS/상수로 분리(운영 정책 미확정 시 TBD).

---

## 4. 핵심 도메인 타입 (제안)

```ts
type Contest = {
  slug: string;
  status: ContestStatus;
  title: string;                 // 영문 기본
  title_ko?: string;
  subtitle?: string;             // "From Your Story to the World"
  city: string | null;           // "Leipzig" — 승인 전이면 표기 수위 조절
  categoryLabels: string[];      // Picture Book / Art Book ...
  ageGroups: AgeGroup[];         // Junior/Middle/Youth
  entryFee: Money;               // { EUR, 70 }
  entryDeadline: string;         // ISO8601, KST 기준 (2026-12-31T23:59:00+09:00)
  exhibition?: { period: string | null; place: string | null }; // 미승인 시 null
  keyDates: { label: string; date: string | null }[];
  isApplyOpen: boolean;          // status==="open" 파생, 서버 권한
};

type AgeGroup = "junior" | "middle" | "youth"; // 7–12 / 13–15 / 16–18

type Participant = {
  nameKo?: string;
  nameEn: string;                // 영문명 필수
  birthDate: string;             // 만 7–18세 검증 (서버)
  country: string;
  school?: string;
  grade?: string;
  guardian?: Guardian | null;    // 미성년자 필수
};

type Guardian = { name: string; email: string; phone?: string };

type WorkFiles = {
  coverImage: UploadRef | null;  // 표지 이미지 1장
  pdf: PdfUploadRef | null;      // 표지 포함 20쪽 이상 단일 PDF
  // 첫 출시(아트북)는 위 2종만. 음원/영상/포트폴리오는 이번 범위 아님.
};

type UploadRef = { fileName: string; sizeBytes: number; url: string | null };
type PdfUploadRef = UploadRef & { pageCount: number | null }; // 페이지수: 서버 검증

type Agreements = {
  originalityCopyright: boolean; // 창작·저작권 확인서
  guardianConsent: boolean;      // 보호자 동의서
  publisherExhibition?: boolean; // 출판작에 한해 필요 시
};

type Work = {
  titleEn: string;               // 영문 작품명 필수
  titleKo?: string;
  descriptionEn: string;         // 영문 작품 소개 필수
  descriptionKo?: string;
  artistBio?: string;            // 작가 소개
};

type Entry = {
  id: string | null;            // Entry ID: 서버 생성 (§5)
  contestSlug: string;
  participant: Participant;
  work: Work;
  files: WorkFiles;
  agreements: Agreements;
  reviewStatus: EntryReviewStatus;
  payment: { status: PaymentStatus; amount: Money; receiptUrl: string | null };
  createdAt: string | null;
  submittedAt: string | null;
};

type Certificate = {
  entryId: string;
  kind: "official_selection" | "finalist";
  certificateId: string;         // 검증 가능한 ID (서버 발급)
  participantName: string;
  workTitle: string;
  contestName: string;
  year: number;
  downloadUrl: string | null;    // 미발급 시 null
};
```

---

## 5. 서버에서 반드시 재검증해야 하는 항목

클라이언트는 UX 보조로만 검사하고, 아래는 **서버가 신뢰 경계**로 재검증한다(모두 Codex 담당).

| 항목 | 클라이언트(UX) | 서버(신뢰 경계) |
|---|---|---|
| PDF 최소 페이지수(표지 포함 20쪽↑) | 가능하면 미리 안내 | **필수 검증** |
| 파일 형식·용량 | 즉시 피드백 | **필수 검증** |
| 참가 연령 만 7–18세 | 생년월일 입력 보조 | **필수 검증** |
| 영문 작품명·소개 필수 | 폼 필수 표시 | **필수 검증** |
| 동의서 3종 체크 | 체크 UI | **필수 저장·검증** |
| 접수 마감(2026-12-31 23:59 KST) | 카운트다운 표시 | **마감 후 차단** |
| €70 결제 성공 | 결제 진입 | **웹훅 확정** |
| Entry ID 생성·고유성 | 표시만 | **서버 생성** |
| 심사 상태 전환 | 표시만 | **서버 권한** |
| 세션·본인확인 | UI 게이트 | **서버 권한(better-auth)** |

클라이언트 전용(서버 불필요): 임시저장 자동저장 UX, 스텝 이동, 입력 미리보기/포맷팅, 언어 토글.

---

## 6. 어댑터 경계 (제안)

```
src/lib/types.ts        // 위 타입 정의 (프런트 소유)
src/lib/api/index.ts    // 서비스 인터페이스 (계약)
src/lib/mock/*.ts       // 인터페이스의 mock 구현 (loading/empty/error/retry 포함)
```

```ts
type RequestState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: T }
  | { kind: "empty" }
  | { kind: "error"; message: string; retry: () => void };

interface ContestService {
  list(): Promise<Contest[]>;
  get(slug: string): Promise<Contest | null>;
}
interface EntryService {
  createDraft(input: Partial<Entry>): Promise<Entry>;
  saveDraft(id: string, patch: Partial<Entry>): Promise<Entry>;
  submit(id: string): Promise<Entry>;          // 결제 성공 후 서버가 확정
  listMine(): Promise<Entry[]>;
}
interface PaymentService {
  createCheckout(entryId: string): Promise<{ redirectUrl: string }>; // Codex
  getStatus(entryId: string): Promise<PaymentStatus>;
}
interface CertificateService {
  listMine(): Promise<Certificate[]>;
}
```

- mock은 위 인터페이스를 구현하되, 결제/웹훅/파일 저장은 **Codex 엔드포인트로 교체될 자리**임을 주석으로 명시한다.

---

## 7. 접수 플로우 단계 — 원문 재확인

**Leipzig 기획서 §8 APPLY FLOW = 8단계** (원문 그대로):

1. 회원가입 / 로그인
2. 참가자 프로필 입력 (미성년자는 보호자 정보 포함)
3. 작품 기본정보 입력
4. PDF 및 필수 자료 업로드
5. 동의서 체크 / 전자 확인
6. €70 결제
7. 접수번호 발급 + 이메일 확인
8. My GYCA에서 접수상태 / 심사결과 / 인증서 확인

- 구 설계서(§4)는 **5단계**(01 참가자→02 작품→03 파일→04 확인·결제→05 완료)로, 로그인(1)·이메일확인(7)·마이페이지(8)를 별도 흐름으로 뺀 형태. **첫 출시는 8단계 기준**으로 구성하되, 데이터 입력 화면은 2~6에 해당한다.

**PDF 최소 페이지 = 표지 포함 20쪽 이상, 단일 PDF** (기획서 §5C·§5D·§13 일치).

**동의서 = 3종** (기획서 §5D):
1. 창작·저작권 확인서
2. 보호자 동의서
3. 출판사 전시 동의서 — *출판작에 한해 필요한 범위에서* (조건부)

---

## 8. 미확정 / Codex 조율 필요

- 언어별 URL 경로 도입 여부 (기존 라우팅 + better-auth 콜백 영향 분석 후 결정)
- 결제 PG·통화 처리 상세, 영수증·환불 정책 문구
- 파일 저장 위치·용량 한도, PDF 페이지수 검증을 서버/업로드 파이프라인 어디서 할지
- Entry ID 포맷 (예: `GYCA-2027-000123`)
- 전시 공식 명칭/장소/로고 표기 수위 (현지 승인 상태에 따른 CMS 토글)
- Official Selection/Finalist 결과 데이터 소스와 인증서 PDF 생성 주체
```
