# 관리자·심사위원 화면 — Codex 합의용 API·상태·필드 목록 (Leipzig 2027)

목적: 관리자·심사위원 화면 구현에 필요한 **API / 상태 / 필드**를 정리하고, 이미 계약된 것과
**신규 제안**을 구분한다. 현재 화면은 전 구간 **mock**(`src/lib/api/ops.ts` + 픽스처)이며 실 연결 0.

담당 경계: **DB·인증·권한·결제 승인/환불·인증서 PDF 생성·저장소·서버 API = Codex.**
프런트는 화면·상태표시·서버가 준 `allowedActions` 기반 게이팅·mock만 담당.

핵심 불변식(스펙 준수):
- **결제 완료 상태를 관리자가 임의로 바꾸는 UI 없음.** 승인·환불은 서버 결제 API + 권한 검증.
- 결과 발표·인증서 발급·CSV 내보내기 실행은 **서버 API + 권한 검증 + 처리 이력**을 거친다.
- **배정되지 않은 작품/권한 없는 목록 접근 차단은 서버 담당**(프런트는 403을 표시만).
- **블라인드 심사는 참가자 데이터에 CSS를 씌우는 방식 금지** → 별도 심사용 데이터 타입 사용.

범위 제한(별도 단계): 고급 통계, 자동 심사 배정, 완전한 드래그앤드롭 폼빌더, 단체접수.

---

## A. 관리자(Admin)

### A.1 흐름
로그인(역할=admin, 서버 검증) → 접수 목록(검색·필터·정렬·페이지) → 접수 상세 → 결과 입력/일괄 변경 →
인증서 발급 대상 관리 → CSV 내보내기 요청. 각 변경은 처리 이력에 남는다.

### A.2 API

| # | 용도 | 메서드/경로(제안) | 요청 | 응답 | 계약 상태 |
|---|------|------------------|------|------|-----------|
| A1 | 접수 목록 | `GET /admin/entries` | search, status, payment, result, sort, cursor, limit | `AdminEntriesPage`(items+nextCursor) | **부분 계약**(`AdminEntry` 존재, 아래 필드 확장 필요) |
| A2 | 접수 상세 | `GET /admin/entries/{id}` | id | AdminEntryDetail(참가자·작품·파일·결제·동의·이력) | **신규 제안** |
| A3 | 보호자 동의 열람 | `GET /admin/entries/{id}/guardian-consents` | id | `GuardianEvidencePage` | **계약됨**(guardian-admin) |
| A4 | 결과 일괄 발표 | `POST /admin/entries:publishResult` | `{ids[], result, actionId}` | `BulkOutcome{requested,succeeded[],failed[{id,reason}]}` | **신규 제안** |
| A5 | 인증서 일괄 발급 | `POST /admin/entries:issueCertificates` | `{ids[], actionId}` | `BulkOutcome` | **신규 제안** |
| A6 | CSV 내보내기 요청 | `POST /admin/entries:export` | 현재 query | `{exportId, status:"queued"}` | **신규 제안**(비동기 작업) |
| A7 | 결제 복구 재큐 | `POST /admin/payments/{orderId}:requeueRecovery` | actionId, reason, expectedUpdatedAt | `PaymentReview` | **계약됨**(payment-admin) |
| A8 | 처리 이력 | A2 응답에 포함(`audit[]`) 또는 `GET .../audit` | id, cursor | `AuditEvent[]` | **신규 제안** |

규칙: 생성형 POST(A4/A5/A6)는 **`actionId`(idempotency) 필수** — 재시도 시 같은 키. 부분 성공은
`succeeded[]`/`failed[{id,reason}]`로 분리 반환(일괄 실패로 뭉개지 않음). **결제 상태 변경 액션은 계약에 없음**(의도).

### A.3 상태
- 접수: `entryStatus`(draft/submitted/received/…), `reviewStatus`, `publishedResult`(nullable=미발표)
- 결제: `payment.state`(read-only 표시), `needsReview`(검토 필요 배지)
- 파일: 접수의 파일 집계 상태(ready/validating/rejected/pending) — 서버 `Asset.state` 기반
- 인증서: `certificateIssued`(발급 여부); 라이프사이클 상태는 참가자용 §6-b(12) 참조
- 일괄: 화면은 **선택 건수·대상 목록·변경 내용**을 확인시키고, **검색 조건 변경 시 선택 초기화**(혼동 방지)

### A.4 필드(목록 행 = `AdminEntryView`) — ★ 계약 확장 필요
현재 `AdminEntrySchema`: `id, participantName, entryStatus, createdAt, submittedAt, receivedAt,
receiptNumber, payment{state,money,needsReview,liveMode}, allowedActions`. UI가 추가로 요구:

| 필드 | 용도 | 요청 |
|------|------|------|
| `workTitle` | 목록/상세 작품명 | 추가(또는 대표 표시명) |
| `reviewStatus` | 심사 진행 표시 | 추가 |
| `publishedResult` | 결과 필터/표시 | 추가 |
| `category`, `ageGroup` | 필터·표시 | 추가(라벨/ID) |
| `fileState`(집계) | 파일 검증 열 | 추가(또는 상세에서만) |
| `certificateIssued` | 인증서 대상 관리 | 추가 |
| `allowedActions` 확장 | `publish_result`, `issue_certificate`, `request_export` 게이팅 | 현재 `view_guardian_consents`만 → 확장 |

---

## B. 심사위원(Judge) — 전부 신규 제안(블라인드)

### B.1 흐름
로그인(역할=judge) → 배정 작품 목록(블라인드) → 심사 화면(PDF 열람 + 항목별 점수·코멘트) →
임시저장 → 최종 제출 → 제출 후 수정 가능 여부는 서버 플래그.

### B.2 API

| # | 용도 | 메서드/경로(제안) | 요청 | 응답 | 계약 상태 |
|---|------|------------------|------|------|-----------|
| J1 | 배정 목록 | `GET /judge/assignments` | (세션 심사위원) | `JudgeAssignment[]` (블라인드) | **신규** |
| J2 | 심사 컨텍스트 | `GET /judge/reviews/{id}` | id | `ReviewContext`(assignment+rubric+draft+revision+pdf) | **신규** |
| J3 | 임시저장 | `PUT /judge/reviews/{id}/draft` | `{scores, comment}` | `{savedAt}` | **신규** |
| J4 | 최종 제출 | `POST /judge/reviews/{id}:submit` | `{scores, comment, expectedRevision}` | `{submittedAt}` | **신규** |
| J5 | 심사 설정(배점) | `GET /judge/rubric` 또는 J2에 포함 | competition | `RubricCriterion[]` | **신규**(설정 데이터) |
| J6 | PDF 열람 | `GET /judge/reviews/{id}/file` | id | 블라인드 처리된 PDF(전송 URL) | **신규** |

규칙:
- **블라인드 데이터 타입** `JudgeAssignment{ id, code, category, ageGroup, reviewState, editableAfterSubmit }`
  — 참가자 이름/식별정보 **없음**. 참가자용 EntryDetail을 받아 가리는 방식 금지.
- **배점은 설정(J5)에서** 온다. 프런트가 배점을 확정하지 않음(현재 mock 배점=dev value).
- J4는 `expectedRevision` 동반 → **동시 수정 충돌**(`REVISION_CONFLICT`) 시 자동 덮어쓰기 금지, 최신 재조회 후 재제출.
- J3 실패 시 "저장됨" 표시 금지.
- **파일명·PDF 내부 식별정보 제거는 Codex(서버) 처리** — 프런트는 블라인드 파일명만 표시(J6).
- **배정되지 않은 리뷰 접근 차단은 서버**(J2가 403/404).

### B.3 상태
- 리뷰: `reviewState`(not_started 미심사 / in_progress 작성 중 / submitted 제출 완료)
- 편집: `editableAfterSubmit`(제출 후 수정 가능 여부) — 서버 플래그
- 저장: 클라 RequestState(저장 중/저장 완료/저장 실패)

### B.4 필드
- `RubricCriterion{ id, label, description, maxScore }` (설정)
- `ReviewDraft{ scores: Record<criterionId, number>, comment }`

---

## C. 역할·권한(authz)
현재 `better-auth`에 admin/judge 역할 모델 없음. Codex가 역할·정책을 서버에서 검증:
- 관리자만 A1–A8, 심사위원만 J1–J6.
- 배정/소유 범위 밖 데이터는 서버가 목록에서 제외하거나 403.
- 프런트는 역할을 **자체 판단하지 않고** 서버 403/allowedActions로만 게이팅.

---

## D. 완료 기준(화면 확인 대상)
정상 / 빈 목록 / 권한 없음(403) / 저장 실패 / 동시 수정 충돌 / 일괄 처리 일부 실패 —
모두 mock 시나리오로 재현(관리자 목록·일괄 모달, 심사 저장·제출 시뮬레이션).

## E. 실제 연결 여부(지금)
| 영역 | 상태 |
|------|------|
| better-auth 로그인/세션 | 실제(역할 모델은 미도입) |
| 관리자 목록/상세/일괄/CSV/이력 | **mock**(`ops.ts`) |
| 심사 배정/컨텍스트/저장/제출/PDF | **mock** |
| 결제 승인·환불·인증서 PDF·권한 검증 | **미연동**(Codex) |

→ 실 연결은 위 API 계약 확정 후 `src/lib/api/ops.ts` 어댑터만 교체. 참고 [submit-flow-contract-proposal.md](./submit-flow-contract-proposal.md) §6-b.
