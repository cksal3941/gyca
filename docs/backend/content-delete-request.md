# 요청: 콘텐츠류 "정식 삭제" 기능 (Codex 백엔드)

작성: 프런트(Claude), 2026-09-21. 사용자 결정으로 **콘텐츠류(공지/뉴스/FAQ·협력기관·아카이브)** 에 하드 삭제를 추가하기로 함. 프런트는 이 스펙에 맞춰 UI/어댑터를 선배선해 둠(아래 §5). 백엔드(마이그레이션+서비스+라우트+계약)는 Codex 영역이라 요청서로 전달.

## 1. 정책 결정 (사용자 확정)
- **대상:** 콘텐츠류만 — `editorial`(공지/뉴스/FAQ), `partners`(협력기관), `projects`(아카이브). **공모(competitions)는 제외**(FK 22개·접수/결제/심사 얽힘, 위험).
- **허용 상태:** **`draft` 또는 `archived`만 삭제 가능.** `published`는 직접 삭제 불가 → 반드시 **보관(archive) 후** 삭제. (공개됐던 감사 흐름 보존, 사고 방지.)
- **동작 기대:** 삭제된 항목은 **관리자 목록·공개 사이트 어디에도 안 보여야 함**(현재 archive는 관리자 목록엔 남음 — 삭제는 그와 달리 완전히 사라져야 함).

## 2. 현재 막는 요소 (조사 결과)
- `gyca_editorial_content.status`·`gyca_partners.status`에 **CHECK 제약** `status IN ('draft','published','archived')` → 새 상태 추가 시 마이그레이션 필요.
- `gyca_editorial_content_changes`·`gyca_competition_changes` 등에 **불변 트리거** `*_changes_immutable`(DELETE/UPDATE 차단) → 물리 삭제 시 이력행 제거 불가.
- `gyca_projects`는 status CHECK 없음(구조 다름 — 확인 필요).

## 3. 구현 방식 — 둘 중 Codex 판단 (프런트는 어느 쪽이든 무관, allowedActions만 맞으면 됨)
**(A) 물리 삭제 (권장 아님, 감사 약화):** draft/archived 콘텐츠의 projection행 + changes행 + actions행을 실제 DELETE. 불변 트리거를 "draft/archived origin 한정 허용"으로 마이그레이션 완화 필요. 프로덕션 권한(트리거/역할) 고려.
**(B) 소프트 삭제=완전 숨김 (권장):** 새 터미널 상태 `deleted` 도입. status CHECK에 `'deleted'` 추가(마이그레이션). `deleted`는 **모든 목록 쿼리에서 제외**(listAdmin·listPublic 둘 다 `status<>'deleted'`). 이력행은 append로 `reason='deleted'` 1건 추가(감사 보존, 트리거 안 건드림). 사용자 요구("어디에도 안 보임")를 감사 무결성 유지하며 충족 — **이 방식을 추천.**

## 4. 계약·API 변경 (공유 contracts)
- `src/contracts/editorial-content.ts` (및 partners/projects 대응):
  - `allowedActions`에 **`"delete"`** 추가. 서버 `actions(status)`가 `draft`→`[edit,publish,archive,delete]`, `archived`→`[delete]`, `published`→`[edit,archive]`(삭제 없음) 반환.
  - (B안 채택 시) 상태 enum에 `"deleted"` 추가하되, **어드민/퍼블릭 목록엔 절대 안 나오게** 서버에서 필터. deleted 항목 단건 조회도 404.
- **라우트:** `DELETE /api/v1/content/editorial/{id}` (partners: `/content/partners/{id}`, projects: `/content/projects/{id}`).
  - 바디: `{ actionId: string(idempotency), expectedRevision: number }` (낙관적 잠금·재시도 안전). Content-Type JSON 필수(빈 바디 415 주의 — 기존 certificate 다운로드 사례 참조).
  - 성공: 200 `{data: {id, deleted:true}}` 또는 204. 프런트는 성공이면 목록 리로드.
  - 오류코드: `NOT_FOUND`(404), `FORBIDDEN`(403, organizer 아님), `REVISION_CONFLICT`(409), `ENTRY_LOCKED`(409, published를 직접 삭제 시도), `IDEMPOTENCY_CONFLICT`(409).
- **서비스:** `createEditorialService`에 `remove(actor, id, {actionId, expectedRevision})` 추가 — authorize→replay(idempotency)→FOR UPDATE→revision 체크→status가 draft|archived 아니면 ENTRY_LOCKED→(A: 물리삭제 / B: status='deleted' + change row)→saveAction. 기존 transition() 패턴 그대로.

## 5. 프런트 선배선 상태 (이미 반영)
- 어댑터 `deleteEditorial(id,{actionId,expectedRevision})`/`deletePartner`/`deleteProject` = `DELETE /content/{type}/{id}` (src/lib/api/ops.ts). 엔드포인트 미배포 시 정직하게 에러 표시.
- 관리자 목록(editorial/partners/projects)에 **삭제 버튼** — `allowedActions.includes("delete")`일 때만 렌더(계약에 delete 추가되면 자동 활성). **확인 게이트 모달**(대상 제목·되돌릴 수 없음 경고 → 확인/취소) 포함.
- 계약에 `"delete"`가 없는 현재는 버튼이 status(draft/archived) 기준으로 임시 노출되되, 실제 호출은 엔드포인트 배포 전까지 "서버 준비 중" 안내로 종료(가짜 성공 없음).

## 6. 검증 요청 (Codex)
- draft 삭제 / archived 삭제 성공, published 직접삭제 차단(ENTRY_LOCKED), 비-organizer 403, revision 불일치 409, idempotency 재시도 안전.
- 삭제 후 관리자 목록·공개 목록·단건 조회에서 완전히 사라짐.
- (B안) `deleted` 상태가 어떤 공개 경로에도 노출 안 됨.
