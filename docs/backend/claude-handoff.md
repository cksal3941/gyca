# Claude 통합 인계 — 단일 진입 문서

최종 갱신: 2026-09-19. 이후 서버 변경 사항은 이 문서에 누적한다. 사용자가 개별 구현 문서를 매번 전달할 필요는 없다. UI/스타일/mock은 Claude 담당으로 유지한다.

### 2026-09-19 중간 점검 후 담당 확대

이후 작업은 [Claude 통합 후속 작업 지시서](../claude-fullstack-work-order-2026-09-19.md)의 9단계로 진행한다. Codex 사용량 절감을 위해 Claude가 공통 계약·백엔드 보완·테스트·배포 준비까지 담당하며 기존 Codex 전용 수정 제한은 이번 인계 범위에서 해제한다. 현재 전체 타입 검사 통과로 관리자 상세 B-2 오류는 재현되지 않았고, checkout API는 존재하되 실제 공급자 연결이 미완료다. 미커밋 공유 의존성 정리부터 시작하고 실제 PG·인프라 검증을 첫 출시 필수 조건으로 유지한다.

### Codex: 파트너 CMS와 관계 확인 게이트

공개 GET `/api/v1/content/partners`, `/{slug}`와 관리자 `/api/v1/admin/content/partners...` 생성·수정·관계 확인·발행·보관·철회 API를 추가했다. **관계 상태가 `confirmed`이고 콘텐츠가 `published`인 항목만 공개한다.** 확인에는 내부 증거 참조와 사유가 필요하고, 철회는 즉시 `revoked + archived`가 되어 공개 API에서 사라진다. 공개 응답은 `no-store`이고 증거·관계 상태·revision을 포함하지 않는다. 화면은 `PartnerAdminItem.allowedActions`로 작업을 표시하고 `pending` 기관을 공식 파트너처럼 렌더링하지 않는다. 정적 `PartnerMarquee` 교체와 관리자 파트너 화면은 프런트 후속 작업이다. [계약과 상태표](partner-cms.md).

### Codex: 공개 편집 콘텐츠 CMS 1차

공지·일정·FAQ·News·Press용 공개 GET `/api/v1/content/editorial`, `/{slug}`와 관리자 `/api/v1/admin/content/editorial...` CRUD/발행/보관 API를 추가했다. 공개 API는 published만 최초 발행시각 최신순으로 반환한다. 관리자 화면은 `EditorialAdminItem.allowedActions`로 edit/publish/archive를 표시한다. 본문은 서식 없는 문자열이므로 일반 텍스트로 렌더링하고 `dangerouslySetInnerHTML`에 넣지 않는다. 현재 정적 `NOTICES` 교체가 프런트 후속 작업이다. Exhibition·Performance·International·Winner·Banner·Archive는 별도 계약 대기다. Partner는 위 전용 계약으로 구현됐다. [계약과 캐시 경계](editorial-cms.md).

### Codex: 회원 탈퇴·개인정보 삭제 요청

참가자 GET/POST `/api/v1/privacy/requests`, POST `/{requestId}/cancel`과 관리자 GET `/api/v1/admin/privacy-requests`, POST `/{requestId}/review`를 추가했다. 참가자는 submitted 상태에서만 취소한다. 관리자는 응답 `allowedActions`에 따라 검토 시작, 보관 보류, 재검토, 실행 승인을 처리한다. 보관/승인에는 사유 코드와 내부 증거 참조가 필요하다. **`approved_for_execution`은 삭제 완료가 아니다.** 실제 익명화·파일 파기 작업자가 없으므로 completed 상태나 완료 API가 없고 화면도 완료로 표시하면 안 된다. [상세](privacy-requests.md).

### Codex: 관리자 운영 대시보드 집계

GET `/api/v1/admin/dashboard?limit=20&cursor=`를 추가했다. `AdminDashboardSchema`로 총 계정, 접수 경험 계정의 최신 거주국 분포, 공모별 접수·결제·심사·공개 결과 집계를 반환한다. 공모 페이지는 ID 순서이며 최대 50개다. 결제 `succeededAmountMinor`는 환불 전 총승인액이므로 매출/정산액 문구를 쓰지 않는다. 참가자·보호자·학교·결제 식별자·심사 코멘트는 응답에 없다. 기관 수는 검증된 기관 엔터티가 없어 제공하지 않으며 학교명 고유 개수로 대체하지 않는다. [필드 의미](admin-dashboard.md).

### Codex: 관리자 접수 CSV 내보내기

POST `/api/v1/admin/competitions/{competitionId}/entries/export`를 추가했다. 본문은 목록과 같은 `q`, `entryStatus`, `paymentState`, `publishedResult`, `sort`이며 모두 선택이다. 성공은 JSON 봉투가 아닌 UTF-8 BOM CSV 원문이므로 `Blob`으로 다운로드한다. 오류만 기존 `{error,meta}` JSON이다. 프런트에서 현재 페이지 데이터로 CSV를 다시 만들지 않는다. 최대 10,000행·20 MiB이며 계정/참가자/보호자 정보가 포함되므로 다운로드 전에 개인정보 포함을 알린다. 서버는 수식 주입을 중화하고 정확한 파일 해시·필터·행 수·실행 계정을 migration 033의 불변 감사 이력에 남긴다. `X-GYCA-Export-ID`, `X-GYCA-Export-Rows` 응답 헤더를 운영 기록에 표시할 수 있다. [상세](entry-export.md).

### Codex: 결제창 시작 서버 계약

POST `/api/v1/orders/{orderId}/checkout`, 빈 JSON을 추가했다. `PaymentCheckoutSessionSchema`의 HTTPS redirect 세션을 반환하며 주문 소유권·동일 Origin·pending/submitted·마감·운영 결제 활성·공급자 범위를 서버에서 검사한다. 공급자가 실제 `beginCheckout` 기능을 제공할 때만 PaymentOrder.allowedActions에 `start_payment`가 생긴다. 현재 런타임 공급자는 hosted checkout을 제공하지 않으므로 실환경은 계속 PAYMENT_UNAVAILABLE이고 mock 결제 성공으로 대체하지 않는다. 토스 공식 공개 문서상 현재 일반 결제는 KRW, 해외 PayPal은 USD이므로 EUR를 임의 연결하지 않는다. 상세는 [payment-checkout.md](payment-checkout.md). 프런트는 start_payment가 있을 때만 endpoint를 호출하고 redirect 도착을 결제 성공으로 간주하지 않는다.

### Codex: 보호자 수동 검증

POST `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/guardian-consents/{requestId}/verify`, 본문 `{entryRevision,evidenceReference}`를 추가했다. 최신 요청·3종 동의 수락·만료 전·현재 revision·정책 토큰·운영자 권한을 모두 재검증하고 migration 020에 변경 불가능하게 기록한다. 이후 참가자 guardian status는 verified, 제출 readiness는 현재 revision/정책에 한해 보호자 차단을 해제한다. 접수나 정책 변경 시 재사용하지 않는다. 관리자 GuardianEvidence에는 `verification`이 추가되고 페이지 `verificationStatus`와 `verify_guardian` 액션이 실제 상태를 반영한다. evidenceReference에는 신분증 번호나 원본을 넣지 않고 내부 검토 기록 참조만 사용한다. [상세](guardian-consent-implementation.md).

### Codex: 긴급 접수 중단 후 재개

POST `/api/v1/admin/competitions/{competitionId}/resume-applications`, 본문 `{revision,reason}`을 추가했다. 최신 중단이 실제 활성 상태에서 시작됐고 현재 공모가 예정/접수 중이며 공개 콘텐츠와 폼이 처리 가능한 경우에만 draftEnabled를 복구한다. paymentEnabled는 바꾸지 않는다. migration 021에 재개 사유와 원래 pause revision을 불변 감사 기록으로 남긴다. 프런트에서 임의로 토글하지 말고 409/503을 운영 상태로 표시한다. [상세](pause-applications.md).

### Codex: 파일·증적 보관 정책

GET/PUT `/api/v1/admin/competitions/{competitionId}/retention-policy`와 migration 022를 추가했다. 철회 초안·미입상작·선정작 파일 삭제 시점과 동의·결제 증적 보관기간을 각각 정수 일수로 받으며 기본값은 없다. 접수/결제 활성 또는 접수 생성 뒤에는 변경하지 못하고 원문을 불변 감사 기록으로 남긴다. migration 023과 내부 작업자는 철회된 미제출 초안의 정확한 S3 버전 파기를 실행한다. 미입상·선정작 연결과 실제 AWS 검증이 남아 있어 launch-readiness.retention은 정책이 있으면 unverified, 없으면 missing이다. [상세](retention-policy.md). 프런트에서 저장 성공을 파기 기능 전체 완료로 표시하지 않는다.

## 현재 화면 연결에 필요한 계약

### Codex: 마이페이지 결제 내역 목록 계약 확정

GET `/api/v1/orders?limit=50&cursor=`는 이제 `Page<OrderSummary>`를 반환한다. item은 `{id,entryId,competitionTitle,workTitle,kind,money,paymentState,createdAt,refundSummary}`이며 공모명·작품명은 제출 당시 동결 스냅샷을 우선한다. 현재 `kind='entry_fee'`, `refundSummary=null`이다. GET `/api/v1/orders/{id}`는 결제 진행용 `PaymentOrder` 그대로이므로 서로 다른 스키마를 사용한다. 기존 프런트 `listMyOrders`의 `OrderSummarySchema` 검증을 그대로 사용할 수 있으며 미확정 경고를 제거한다.

### Codex: 결제 검토 사유 코드

`PaymentReviewSchema`에 `reviewReasons`와 `reviewedAt`을 추가했다. `needsReview=false`이면 `[]`/null, true이면 최초 검토 결제 이벤트에서 금액/통화 불일치, 공급자 검토 요구, 승인 시각 이상, 결제 증거·식별자 충돌, 마감 후 승인, 접수 상태 충돌을 안전한 코드로 반환한다. 이전 수동 데이터처럼 근거 이벤트가 없으면 `LEGACY_UNKNOWN`이다. PG 원문·결제 키·가맹점·이벤트 ID는 노출하지 않는다. 프런트 mock과 EN/KO 카피를 새 필드에 맞춘다. [코드와 제한](payment-admin-implementation.md).

### Codex: 마감 후 승인 결제의 운영 접수 확정

POST `/api/v1/admin/competitions/{competitionId}/payment-reviews/{orderId}/accept-late-payment`, body `{actionId,reason,expectedReviewedAt}`를 추가했다. 서버 `allowedActions`에 `accept_late_payment`가 있을 때만 노출한다. 이 액션은 결제 성공·submitted·검토 이벤트 하나·검토 사유가 `APPROVED_AFTER_DEADLINE` 하나뿐인 경우에만 가능하다. 성공 시 접수번호·received·메일 outbox·불변 운영 감사가 함께 저장되며, 다른 검토 사유나 후속 검토 이벤트는 계속 차단된다. `expectedReviewedAt`에는 조회 응답 값을 그대로 보낸다. 성공 후 상세를 다시 조회하고 반환된 접수번호를 표시한다. [계약과 검증](payment-admin-implementation.md).

### Codex: PG 조회 응답 사전 검증

조회 결과가 여러 이벤트일 때 일부를 저장한 후 뒤쪽 형식 오류가 발견되는 경우를 재현하고 수정했다. 전체 응답의 형식·주문 ID·가맹점·test/live 범위를 먼저 검사한 뒤 이벤트별 원장 반영을 수행한다. 형식/범위 오류 시 이번 응답에서는 어떤 이벤트도 반영하지 않는다. DB 적용 자체는 기존 이벤트별 트랜잭션이므로 전체 응답의 일괄 원자성을 의미하지 않는다. 실패 후 10초 조회 제한 유지와 정상 재조회 복구 포함 관련 45개 테스트·타입·ESLint 통과. 실제 PG 및 프런트 변경 없음.

### Codex: 마감 후 승인 조회의 요청 간격 제한

confirm이 마감/재시도 만료로 조회 전용 경로에 진입할 때 기존 reconcile과 동일한 DB 기반 10초 간격 제한을 사용하도록 수정했다. 두 경로를 번갈아 호출해도 제한을 우회하지 못한다. confirm에서도 이 경우 429 RATE_LIMITED가 반환될 수 있으므로 결제 실패로 확정하거나 즉시 반복하지 않는다. 계약 추가는 없으며 기존 오류 처리를 사용한다. 회귀 재현 후 결제/복구/접수 중단 관련 44개 테스트·타입·ESLint 통과. 실제 PG 호출 및 프런트 수정 없음.

### Codex: 승인 재시도 만료 경계 보완

결제 승인 예약 트랜잭션이 끝난 뒤 외부 호출 직전에도 공급자 재시도 허용 만료 시각을 확인하도록 보완했다. 그 사이 허용 기간이 끝나면 approve 재호출 대신 조회만 수행한다. 결제 마감 재검사와 동일하게 적용하며 프런트 계약 변경은 없다. 경계 회귀 테스트와 결제/복구/접수 중단 통합 테스트 총 43개, 타입·ESLint 통과. 실제 PG 호출은 하지 않았다.

### Codex: 초안 취소 감사 기록

019_draft_withdrawals migration을 추가하고 공식 로더에 등록했다. 취소 계정·취소 전후 revision·시각을 변경 불가능한 이력으로 저장한다. 이력 실패는 접수/파일 변경도 롤백하며 재전송 시 이력의 최초 시각을 반환한다. 기존 취소 API 계약은 동일하다. 실제 DB migration은 실행하지 않았다. Claude는 019 번호를 사용하지 않는다. 임의로 withdrawn 처리된 이력 없는 기존 행에 대해 최초 취소 이력을 추정 생성하지 않으며 재전송은 409다. 테스트·타입·ESLint 통과.

### 초안 취소 버튼 서버 판정

GET `/api/v1/entries/{id}/withdraw-draft` 추가. DraftWithdrawalReadinessSchema의 entryId/revision/allowedActions/blockingReasons를 반환한다. `withdraw_draft`가 있을 때만 취소를 제공하고 해당 revision으로 기존 POST를 호출한다. 조회 후 수정/제출이 끼어들면 POST가 재검증하여 409로 막으므로 조회 결과를 영구 권한으로 취급하지 않는다. 이 액션은 전용 계약에만 있고 기존 ENTRY_ACTIONS는 바꾸지 않았다. 마감 후에도 미제출 초안 취소는 가능하다. 취소 후 복원은 지원하지 않는다. 권한·취소 가능/차단과 파일 갱신 실패 시 접수 상태/리비전 롤백을 테스트했다. 프런트 파일 변경 없음.

### Codex: 초안 취소 API

POST `/api/v1/entries/{id}/withdraw-draft`, JSON `{revision}`. 새 `draft-withdrawal.ts` 계약 사용. 본인 소유이고 제출 스냅샷/주문/제출시각이 없는 draft만 withdrawn으로 전환한다. 권한 없는 ID 404, 변경된 revision 409, 제출/결제 건 409, Origin 검사 적용. 같은 원래 revision 재전송은 같은 결과를 반환한다. 반환값 entryId/revision/entryStatus/withdrawnAt. 취소 후 기존 상세/목록 조회는 가능하지만 수정·제출 액션은 없다. 이 endpoint는 초안 취소 전용이며 환불·파일 영구삭제가 아니다. 이미 발급된 S3 PUT URL을 취소하지는 못하며 서버의 파일 검사 결과 반영은 차단한다. 취소 복원 API는 없다. 현재 ENTRY_ACTIONS에 취소 액션은 추가하지 않았으므로 버튼 연결은 후속 조율한다. 프런트 파일은 수정하지 않았다.

### Codex 병렬 작업: 저장소 사전 점검

읽기 전용 `scripts/storage-check.mjs` 추가. 기존 S3 설정으로 버전 관리·공개 접근 차단을 확인하는 운영 도구이며 화면/API 계약 변경은 없다. Claude의 어댑터·심사 파일은 수정하지 않았다. 실제 AWS 실행은 미실시. [실행 범위](storage-preflight.md).

### 관리자 접수 검색

GET `/api/v1/admin/competitions/{competitionId}/entries?q=검색어` 지원. 참가자명·표시 작품명·received 접수번호의 대소문자 무시 부분 검색이며 현재 entryStatus/cursor/limit과 함께 사용할 수 있다. q 최대 200자, 앞뒤 공백 제거, 빈 값은 전체 목록, 중복 q는 422다. `%`/`_`는 와일드카드가 아닌 문자다. 작품명은 앞선 스냅샷/초안 규칙을 따른다. 검색어나 상태 변경 시 cursor와 선택 목록을 초기화하고 이후 페이지에 동일 검색 조건을 보낸다. 정렬은 기존 UUID 오름차순이며 최신순/이름순은 아직 미지원이다. 연락처·생년월일은 검색하지 않는다. 부분 문자열 검색의 운영 규모 성능은 미검증이다. PGlite 검색·상태 조합·페이지 이동·특수문자 검사, 타입·ESLint 통과. 프런트는 수정하지 않았다.

### 관리자 목록 작품 정보

GET `/api/v1/admin/competitions/{competitionId}/entries`가 `{items,nextCursor,total}`과 workTitle/category/ageGroup/reviewStatus/publishedResult/fileState/certificateIssued를 제공한다. `paymentState`, `publishedResult`(`not_announced` 포함), 기존 entryStatus/q 필터와 `created_desc|created_asc|name_asc` 정렬을 지원한다. nextCursor는 불투명 키셋 커서이며 정렬·검색·필터 변경 시 반드시 초기화한다. category/ageGroup은 표시 라벨이 아닌 ID다. 제출 건의 이름·작품은 동결 스냅샷에서 읽는다. `allowedActions`는 제출 이력이 있을 때 `view_guardian_consents`, 현재 공개 단계 인증서가 없을 때 `issue_certificate`만 제공한다. 행별 결과 발표나 결제 변경 액션은 없다. [상세](admin-entries-implementation.md).

### 관리자 접수 상세

GET `/api/v1/admin/competitions/{competitionId}/entries/{entryId}`를 추가했다. `src/contracts/admin-entry-detail.ts`의 `AdminEntryDetailSchema`를 사용하며 목록 필드에 참가자·작품·파일 검사·보호자 확인 상태·제출 당시 3종 동의 요약·인증서·최근 감사 이력 최대 100건을 더한다. 제출 건은 현재 수정값이 아니라 동결 스냅샷을 사용한다. PG 키/가맹점, 저장소 키/version, 보호자 이메일·토큰·검증 참조, 동의문 전문은 노출하지 않는다. 전문과 보호자 증적은 기존 별도 권한 API를 사용한다. Claude는 기존 mock `getAdminEntry`를 이 GET으로 교체하고 `allowedActions`로 상세 버튼을 표시한다. [계약·노출 경계](admin-entry-detail.md).

### 공모별 결제 운영 집계

GET `/api/v1/admin/competitions/{competitionId}/payment-health` 추가. PaymentHealthSchema 사용. 주문 상태별 수·needsReview와 복구 큐 상태별 수·실행 가능한 대기 작업·점유 만료 작업을 제공한다. 공모별 결제 viewer/operator 필요. needsReview/due/expiredLeases는 다른 수와 겹치므로 합산하지 않는다. DB 집계이며 PG 장애/접수 실패/실매출을 자동 판정하지 않는다. [필드 의미·제한·검증](payment-health.md). 프런트는 변경하지 않았다.

### 결제 재확인 진단 필드

PaymentReviewSchema.recovery에 lastErrorCode, nextAttemptAt, leaseExpiresAt 추가. 목록/단건 모두 제공한다. nextAttemptAt은 pending일 때만, leaseExpiresAt은 running일 때만 값이 있으며 나머지는 null이다. 오류는 공통 ERROR_CODES로 EN/KO 매핑한다. 작업 점유 만료를 결제 마감이나 버튼 허용 기준으로 사용하지 않는다. mock의 recovery 객체에도 세 필드를 반영해야 한다. [의미와 검증](payment-admin-implementation.md). 프런트는 변경하지 않았다.

### 제출 파일 다운로드

POST `/api/v1/entries/{entryId}/submission/assets/{assetId}/download` 추가. 동일 출처 Origin/로그인 필요, 본문 없음. SubmissionDownloadSchema의 `{url,expiresAt}`로 제출 당시 파일 버전의 60초 다운로드 링크를 받는다. 저장소 미설정은 503이며 실제 다운로드 성공으로 표시하지 않는다. URL은 임시 자격이므로 분석/로그/저장소에 남기지 않는다. [오류·동작·S3 권한](submission-download.md). 프런트는 변경하지 않았다.

### 참가자 제출 기록 확인

GET `/api/v1/entries/{entryId}/submission` 추가. `@/contracts/submission-record`의 SubmissionRecordSchema 사용. view_submission에서 본인 제출 당시 참가자·작품·파일 목록·3종 동의를 조회한다. 파일 URL과 내부 정책은 제외한다. 미제출 초안/타인 건은 404다. 현재 결제/접수 상태는 포함하지 않으므로 기존 접수 조회와 함께 사용하고, 기록 존재를 received로 해석하지 않는다. [상세 계약·검증](submission-record.md). 프런트는 변경하지 않았다.

### 제출 당시 3종 동의 이력

GET `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/consents` 추가. `@/contracts/consent-evidence`의 ConsentEvidenceSchema 사용. 현재 정책이 아니라 제출 당시 3종 동의 원문·버전·해시·계정 ID·서버 동의 시각을 반환한다. 실제 공모 운영 권한 필요. 초안은 404이며 보호자 동의는 기존 guardian-consents로 별도 조회한다. 원문은 텍스트로 렌더링한다. [상세 계약과 검증](consent-evidence.md). 프런트 변경은 하지 않았다.

### 관리자 단건 결제 상태 추적

GET `/api/v1/admin/competitions/{competitionId}/payments/{orderId}` 추가. 기존 PaymentReviewSchema와 `{data,meta}`를 재사용한다. 재확인 작업 재개 후 payment-reviews 목록에서 사라진 주문도 이 경로로 추적한다. 공모별 viewer/operator 권한 필요. GET은 DB 상태만 읽으며 PG 재조회/결제 승인을 실행하지 않는다. [권한·오류·검증](payment-admin-implementation.md). 프런트 변경은 하지 않았다.

### 로그인 계정의 실제 운영 권한

GET `/api/v1/admin/access` 추가. `@/contracts/admin-access`의 AdminAccessSchema 사용. data는 `{organizer,paymentPermissions:[{competitionId,permission:'viewer'|'operator'}],nextCursor}`다. 일반 참가자도 200이며 false/빈 목록을 반환한다. 비로그인은 401이다. limit 1~50(기본 20), cursor로 전체 페이지를 처리한다. 공모 운영 권한과 결제 권한은 서로 독립적이다. 메뉴 표시용이며 실제 작업 API의 권한 검사와 403 처리는 계속 필요하다. UI 역할 선택이나 이메일로 권한을 추정하지 않는다. [상세 계약·검증](admin-access.md). 프런트 변경은 하지 않았다.

### 새 접수 중단

후속 통합 테스트에서 중단 후 새 접수/수정/업로드/제출 차단과 기존 제출 건의 주문→결제 확인→접수번호 발급, 중복 승인 방지를 함께 검증했다. API 계약 변경은 없으며 실제 PG 호출은 가짜 공급자로 대체했다.

POST `/api/v1/admin/competitions/{competitionId}/pause-applications`, body `{revision,reason}`를 추가했다. `src/contracts/application-pause.ts` 사용. draftEnabled만 false로 바꾸고 결제 플래그는 유지한다. 실제 재개 API는 아직 없으며 운영 적용 전 복구 절차가 필요하다. [영향과 제한](pause-applications.md)을 참고한다. 실제 공모나 프런트 코드는 변경하지 않았다.

### 정책 변경 이력

제출/결제 정책 경로 뒤에 `/history`를 붙인 GET을 추가했다. `src/contracts/policy-history.ts`로 연결한다. 변경 당시 원문·담당자·시각을 revision 내림차순으로 제공하고 limit/cursor를 지원한다. 제출 정책은 공모 운영자, 결제 정책은 해당 공모 viewer/operator 권한을 따른다. [세부 계약](policy-history.md) 참고. 조회 전용이며 복원 버튼은 없다.

### 업로드 정책 진단 보정

후속으로 공개 공모 API도 지원 밖 업로드 정책이면 readiness.application=false로 반환하고 start_entry를 제거한다. 참가비 0원은 readiness.payment=false다(현재 무료 접수 미지원). 프런트가 정책 저장 성공이나 status=open만으로 Apply/결제 버튼을 켜지 않도록 기존 서버 액션 기준을 유지한다.

오픈 진단의 form 검사와 실제 업로드·제출 검사가 같은 `src/server/uploads/policy.ts` 규격을 사용하도록 수정했다. 현재 서버는 최대 64MiB, 표지 PNG/JPEG, 책·증빙 PDF를 처리한다. 지원 밖 형식·상한이나 이미지 페이지 수 조건을 저장하면 form 진단은 missing, 실제 신규 업로드는 POLICY_NOT_CONFIGURED로 차단될 수 있다. 저장 성공을 처리 가능으로 간주하지 않는다. 영상/음원 지원을 추가한 것은 아니다. 기존 UI/계약 필드는 변경하지 않았다.

### 관리자 결제 정책

GET/PUT `/api/v1/admin/competitions/{competitionId}/payment-policy` 추가. `src/contracts/payment-policy.ts`를 사용한다. PUT은 `{revision,policy,routing}`이며 결제 승인 시각 기준·국가별 경로·환불 문구를 함께 저장한다. 해당 공모 viewer는 조회, operator만 수정 가능하다. 금액/일정은 기존 공모 API이며 revision을 공유한다. 저장만으로 결제가 활성화되지 않는다. [세부 계약](payment-policy-admin.md), 마이그레이션 017 참고. 실제 정책·PG 설정은 미실행이다.

### 관리자 제출 정책

GET/PUT `/api/v1/admin/competitions/{competitionId}/submission-policy`를 추가했다. `src/contracts/submission-policy.ts`로 연결한다. PUT은 `{revision,policy}`이며 공모와 revision을 공유한다. 3종 동의문·국가별 보호자 기준을 저장하지만 접수/결제 플래그는 켜지 않는다. 활성 공모 또는 접수 존재 시 수정 불가다. [세부 계약](submission-policy-admin.md), 마이그레이션 016을 참고한다. 실제 정책 값은 미확정 상태로 유지했다.

### 관리자 접수 이메일 상태

GET `/api/v1/admin/competitions/{competitionId}/receipt-deliveries`를 추가했다. `src/contracts/receipt-admin.ts`의 ReceiptDeliveryPageSchema를 사용한다. pending/running/provider_accepted/stalled, 시도 횟수·예정 시각·이메일 확인 여부를 제공한다. provider_accepted는 수신함 도착이 아니다. allowedActions=[]이며 재발송 버튼은 제공하지 않는다. [세부 계약](receipt-delivery-admin.md)을 참고한다.

### 비밀번호 재설정 서버

[비밀번호 재설정](password-reset.md)을 기존 Better Auth에 연결했다. AUTH_PASSWORD_RESET_ENABLED 기본 false다. 메일은 `/reset-password#<token>`으로 연결하고 프런트는 fragment를 제거한 뒤 POST `/api/auth/reset-password` body로 token/newPassword를 전달한다. 토큰 30분, 변경 후 기존 세션 종료, 자동 로그인 없음. 실제 화면은 미구현이며 UI·메일 검증 후 활성화한다. `/api/v1` 봉투와 Better Auth 응답을 혼용하지 않는다.

### 접수 UI: 첫 출시·전체 시연 데이터

[두 시나리오 연결 자료](submission-ui-scenarios.md)와 `docs/backend/examples/submission-scenarios.mjs`를 추가했다. first-release는 핵심 입력+표지/PDF, full-preview는 현재 계약의 모든 필드·업로드 항목이다. 한/영 필수 동의 3종을 제공하고 optionalConsents는 양쪽 모두 빈 배열이다. 홍보 수신 동의는 실제 계약에 추가하지 않았다. 실제 동의문·정책이 아닌 시연 데이터이며 readiness=false, allowedActions=[]를 유지한다. 기존 Claude mock·화면 파일은 변경하지 않았다.

### 운영자 계정 준비

`scripts/manage-organizer.mjs`와 마이그레이션 014에 공모 운영자 권한 부여·회수 및 감사 기록을 추가했다. [운영 절차](organizer-access.md)를 따른다. 기본은 미리보기이며 --apply 실행만 변경한다. 실제 계정 권한은 아직 부여하지 않았다. 프런트 역할 선택·이메일 문자열은 권한 근거로 사용하지 않는다. 결제 운영 권한은 별도다.

공모별 결제 권한은 `scripts/manage-payment-access.mjs`와 마이그레이션 015로 관리한다. viewer는 예외 목록/이력 조회, operator는 허용된 복구 재개까지 지원한다. [결제 권한 절차](payment-access.md)를 참고한다. 화면/API 계약은 바뀌지 않았고 실제 권한은 아직 없다.

### 백그라운드 작업 실행 도구

결제 복구·접수 이메일용 `scripts/run-scheduled-jobs.mjs`를 추가했다. 공개 API 계약 변경은 없다. [운영 실행 방법](scheduled-jobs.md)에 설정·오류 처리·검증 범위를 정리했다. 스케줄러 처리나 메일 발송 여부로 프런트에서 접수 상태를 파생하지 않는다. 실제 스케줄 등록은 아직 없다.

### 관리자 공모별 접수 목록

GET `/api/v1/admin/competitions/{competitionId}/entries`를 추가했다. `src/contracts/admin-entries.ts`의 AdminEntriesPageSchema를 사용한다. limit/cursor/entryStatus 필터를 지원하며 참가자 이름·접수 상태·결제 상태·금액·테스트 여부를 제공한다. payment.state=succeeded만으로 접수 완료를 표시하지 않는다. received일 때만 접수번호가 나온다. allowedActions의 view_guardian_consents로 아래 동의 이력 조회에 연결한다. [세부 계약](admin-entries-implementation.md)을 참고한다. 기존 디자인 변경은 없다.

### 보호자 이메일 동의 — 화면 연결 전 비활성 유지

재발송은 기존 접수별 제한 외에 계정 전체 최근 1시간 20건 제한을 추가했다. 초과 시 동일 RATE_LIMITED 429이며 자동으로 새 접수를 만들어 재시도하지 않는다. 계약 필드 변경은 없다.

[보호자 동의 API](guardian-consent-implementation.md)를 추가했다. 요청 스키마는 `src/contracts/guardian-consent.ts`다. `/guardian-consent#<token>` 페이지에서 3종 동의를 분리하고 토큰은 POST body로만 전달한다. 기본 플래그는 false다. consented는 이메일 동의 기록이며 보호자 신원 확인이나 제출 허용이 아니다. 운영자 승인 API·확인 정책은 아직 없으므로 pending_review로 안내하고 `GUARDIAN_VERIFICATION_REQUIRED`를 유지한다.

관리자 이력 GET `/api/v1/admin/competitions/{competitionId}/entries/{id}/guardian-consents`를 추가했다. `src/contracts/guardian-admin.ts`의 GuardianEvidencePageSchema로 연결한다. limit/cursor 페이지 탐색, 당시 문서·접수 revision·이름·수락 시각을 제공한다. 권한은 전체 공모 운영자 gyca_competition_editors다. 현재 verificationStatus=not_verified, allowedActions=[]이며 승인 버튼은 제공하지 않는다. 이력 조회와 현재 요청의 유효성 판단을 구분한다. 자세한 필드와 오류는 위 문서의 관리자 증적 조회 항목에 있다.

### 이메일 소유 확인 — 화면 연결 전 비활성 유지

[이메일 확인](email-verification-implementation.md) 서버 연결을 추가했다. AUTH_EMAIL_VERIFICATION_ENABLED 기본 false이며, 활성화하면 비밀번호 가입 후 바로 로그인되지 않는다. 확인 안내·재발송 버튼·EMAIL_NOT_VERIFIED·429 처리 화면을 연결한 뒤 켠다. 확인 링크는 /login으로 돌아온다. 사용자에게 지금 개별 문서를 전달 요청할 필요는 없고, 인증 화면 연동 시 이 항목을 함께 반영한다.

### 접수 완료 이메일

[접수 이메일](receipt-email-implementation.md) 서버 기반을 추가했다. 공개 프런트 API 변경은 없다. 이메일 실패와 무관하게 received이면 접수 완료로 표시한다. 메일이 왔다는 이유로 접수 상태를 파생하지 않는다. 실제 이메일 소유 확인·발신 도메인·스케줄러 연결은 남아 있다.

### 배포 준비

[배포 실행 절차](deployment-runbook.md)에 환경 점검·인증/플랫폼 스키마 순서·컨테이너 구성을 정리했다. 이번 변경으로 프런트 API 요청 형식은 바뀌지 않는다. 사용자에게 별도 전달 요청할 필요가 없다.

`scripts/database-check.mjs`가 실제 DB 연결·마이그레이션 이력·주요 스키마를 읽기 전용으로 점검한다. 마이그레이션과 점검의 목록은 `scripts/lib/platform-migrations.mjs`로 통일했다. 설정이 준비된 뒤 별도로 실행하며 실제 DB에는 아직 연결하지 않았다. 이 검사 통과를 프런트의 canOpen으로 사용하지 않는다.

### 최신 변경: AWS S3 파일 저장

기존 업로드 API 계약을 유지하고 S3 공급자를 연결했다. `upload.method=PUT`일 때 파일 원본을 body로 보내고 반환된 headers를 그대로 사용한다. multipart/form-data로 감싸지 않는다. Content-Length는 브라우저가 파일 크기로 설정하므로 직접 설정하지 않는다. 성공 후 기존 complete API로 서버 검사를 요청한다. PUT 성공만으로 제출 가능한 파일이라고 표시하지 않는다.

같은 URL로 다시 업로드해 412를 받으면 이미 객체가 존재할 수 있다. 자동 덮어쓰기나 새 파일 완료로 간주하지 말고 complete로 서버 확인한다. 설정·권한·서명 만료 오류도 처리한다. 현재는 최대 64MiB의 PDF/표지 이미지 단일 PUT이며 분할/재개 업로드는 없다.

storage 진단은 설정 없으면 missing, S3 설정이 있으면 unverified다. 실제 AWS 연결·CORS·브라우저 업로드 검증 전에는 configured/오픈 완료로 표시하지 않는다. 자세한 운영 설정은 [S3 연결](s3-storage-implementation.md)을 따른다.

1. 공모 등록·수정·공개: [공모 관리 API](competition-admin-implementation.md). 공개와 접수 시작은 별개다. 실제 DB 및 관리자 권한은 아직 설정하지 않았다.
2. 결제 경로 선택: [경로 고정](routed-orders-implementation.md). orders POST는 routeId, policyToken, acceptedRefundNotice를 요구한다. create_order는 결제창 시작이 아니다.
3. 관리자 결제: [결제 확인 API](payment-admin-implementation.md). 중단된 조회 재개만 지원하며 수동 결제 성공 처리 기능은 없다.

## 신규: 접수 오픈 준비 진단

GET `/api/v1/admin/competitions/{competitionId}/launch-readiness`

권한은 gyca_competition_editors의 실제 계정으로 확인한다. 응답은 `{data,meta}`이며 `@/contracts/launch-readiness`의 LaunchReadinessSchema를 사용한다. data는 competitionId, revision, checks, canOpen, allowedActions다.

checks의 code는 public_content, published, schedule, form, consents, guardian_policy, payment_policy, payment_routes, storage, guardian_verification, checkout, retention, live_payment_verification이다. EN/KO 카피는 프런트에서 관리한다.

- configured: 해당 설정의 구조가 준비됨. 외부 서비스 실동작·법률 적합성 승인이 아니다.
- missing: 설정이나 구현이 부족함.
- unverified: 실제 검증이 남음.

이번 단계의 canOpen은 항상 false, allowedActions는 빈 배열이다. 접수 활성화 API가 아니므로 화면에서 오픈 버튼을 만들지 않는다. guardian_verification과 checkout은 설정·실검증 상태에 따라 진단하고, retention은 정책이 있더라도 외부 검증과 나머지 결과 연결이 남아 unverified다. live_payment_verification도 unverified이며 storage는 위 최신 변경을 따른다.

EN/KO 3종 동의문 준비와 결제 경로의 모든 지원 국가에 대한 보호자 기준 표 존재를 확인한다. 국가별 연령의 법률 적합성이나 작품 이용허락 문구의 법적 효력을 자동 판단하지 않는다. form 진단은 첫 아트북 접수 규격 기준이며 일반 공모전 폼 빌더가 아니다.

이 GET은 상태·정책·권한을 변경하지 않는다. 원문 동의서, 가맹점 ID, 비밀 키도 반환하지 않는다. 401/403/404 및 private,no-store는 기존 관리자 규칙이다. 공개 Competition.readiness와 달리 내부 오픈 준비 점검이므로 혼용하지 않는다.

## 검증 기록

최신 통합 검증은 **269개 테스트 통과, 실패/건너뜀 0**, 프로젝트 타입 검사·서버 ESLint 통과다. migration 037 파트너 CMS와 관계 확인 게이트, migration 036 공개 편집 콘텐츠 CMS, migration 035 개인정보 요청 워크플로, migration 034 관리자 대시보드 집계 인덱스, migration 033 관리자 CSV 내보내기, migration 032 접수·결제 최초 오픈 경계, migration 031 환불 원장과 기존 접수/결제/심사/결과/보관 회귀 검증을 포함한다. 실제 운영 DB/외부 서비스 검증은 별도다.

### Codex: 접수·결제 최초 오픈

launch-readiness는 더 이상 계약상 항상 false가 아니다. 13개 check가 모두 configured이고 아직 비활성일 때만 `canOpen=true`, `allowedActions=['open_applications']`를 반환한다. `storage`, `retention`, `live_payment_verification`은 `POST .../launch-verifications`로 현재 공모 revision과 유효기간에 묶인 운영 증거를 먼저 기록한다. 이후 `POST .../open-applications`가 draft/payment 두 플래그를 한 트랜잭션으로 켠다. 화면은 allowedActions만 사용한다. 테스트 결제 경로나 만료·이전 revision 증거로는 열리지 않는다. [세부](launch-control.md).

### Codex: 환불 원장과 관리자 환불

`GET/POST /api/v1/admin/competitions/{competitionId}/payments/{orderId}/refunds`를 추가했다. GET의 `allowedActions`에 `request_refund`가 있을 때만 POST를 제공한다. POST는 `{actionId,amountMinor,reason}`이며 원결제·기존 pending/succeeded 환불을 잠근 상태에서 한도를 검사한다. 공급자 응답 유실은 pending으로 남고 같은 actionId로만 안전하게 재호출한다. 참가자 주문 목록 `refundSummary`도 실제 환불 합계로 채운다. [계약·운영 경계](refunds.md).

### Codex: 마이페이지 접수 표시 필드

`GET /api/v1/entries`와 `GET /api/v1/entries/{id}`의 공통 계약에 아래 필드가 추가됐다.

- `competitionTitle: {en,ko}`
- `workTitle: string`
- `categoryLabel: {en,ko} | null`

제출 기록이 있으면 세 값은 제출 시 저장된 immutable snapshot을 우선한다. 이후 운영자가 공모명이나 부문 라벨을 바꿔도 참가자가 본 제출 표시값은 변하지 않는다. 초안과 snapshot이 없는 과거 자료는 현재 공모 content와 entry work로 보완한다. 부문이 비었거나 당시/현재 formSpec에서 찾을 수 없으면 `categoryLabel=null`이다. 프런트는 competitionId로 공개 공모 목록을 다시 조인하지 말고 이 필드를 사용한다.

2026-09-16 최신 통합 실행: **202개 테스트 전체 통과**, 프로젝트 타입 검사·서버 ESLint 통과. 정책 관리/이력, 접수 중단 후 기존 건 결제 흐름, 운영 권한 조회까지 함께 재검증했다. [실행 로그](verification-admin-access.log)와 [검증 범위](verification-status.md)를 참고한다. 이번 검증에서 계약이나 프런트 변경은 없다. 아래 190/191개 및 184개 수치는 이전 실행 기록이다.

인증 재설정·권한 도구 추가 후 전체 테스트 190개, 타입·서버 코드 검사 통과. 이후 CLI 입력/비밀 정보 비노출 테스트 1개도 통과했다. 총 191개 검증이며 [최신 결과](verification-status.md)를 참고한다. 프런트 계약 변경은 없다.

2026-09-16 전체 서버 테스트 184개, 프로젝트 타입 검사, 서버·계약·API·테스트 ESLint 통과. 재검증은 `node scripts/verify-backend.mjs` 한 명령으로 실행한다. [범위와 실행 로그](verification-status.md)를 참고한다. PGlite·로컬 공급자 테스트 기반이며 실제 DB·스토리지·메일·PG 또는 전체 화면 검증 완료를 뜻하지 않는다.

## 현재 외부 준비 상태

### 최신 변경: 철회 초안 파일 파기 큐

프런트 계약 변경은 없다. 철회된 미제출 초안 중 정확한 S3 VersionId가 저장된 파일만 공모 보관 정책에 따라 파기 큐에 들어간다. 내부 작업자는 별도 자격 증명으로 해당 버전만 삭제하고 재시도·중단·불변 감사 기록을 남긴다. 정책이 없거나 버전이 불명확하면 삭제하지 않는다. 실제 AWS와 스케줄러가 검증되지 않았으므로 launch-readiness의 retention은 계속 unverified로 표시한다.

### 최신 변경: 단계별 결과 공개와 보관 예약

관리자 심사 결정 GET/PUT과 Official Selection→Finalist 두 라운드 공개 POST를 제공한다. 공개 전 decision은 참가자 응답에 포함하지 않고 `publishedResult=null`을 유지한다. 모든 received 건의 결정 완료, 결제 확인 중인 submitted 건 부재, 마감 경과, 보관 정책을 서버가 확인한다. 첫 라운드는 미입상 파일만, 두 번째 라운드는 선정 파일을 각 정책 기간으로 파기 예약한다. [상세](result-publication.md).

### 최신 변경: 블라인드 심사 API 기반

공모별 review-rubric GET/PUT, 관리자 judge-assignment POST, 심사위원 assignments/context/draft/submit API를 추가했다. 프런트 mock 배점은 운영값으로 사용하지 말고 서버 rubric을 그대로 렌더링한다. 저장·제출 요청은 `{expectedRevision,draft:{scores,comment}}`이며 응답 revision으로 다음 요청을 보낸다. 심사 응답에는 참가자 개인정보·접수번호·결제·보호자·원본 제목이 없다. [상세](judging.md).

블라인드 파생 PDF가 준비되지 않으면 context의 `pdf=null`, `blockingReasons=['BLINDED_FILE_NOT_READY']`다. 현재 프런트 `ReviewContext.pdf`를 nullable로 바꾸고 이 상태를 표시해야 실 API에 연결할 수 있다. 원본 PDF URL로 대체하면 안 된다.

migration 026과 블라인드 작업자를 추가했다. 배정 생성 시 원본 PDF의 key+VersionId를 고정하고 별도 객체를 생성하지만, 자동 생성 직후에는 심사위원에게 노출하지 않는다. 관리자가 후보 PDF의 모든 페이지에서 이름·학교 등 식별정보가 보이지 않음을 확인하고 후보 version+checksum과 확인 메모를 승인 API에 보내야 기존 context의 pdf가 채워진다. 운영 화면은 [judging.md](judging.md)의 관리자 blind-asset GET/approve POST를 사용한다.

심사위원 운영 API는 `GET /api/v1/admin/judges`, `PUT /api/v1/admin/judges/{userId}`다. PUT은 기존 Better Auth 사용자 ID, `expectedActive`, `active`, `reason`을 요구한다. 미완료 배정이 있는 계정은 비활성화할 수 없다. 초대 메일과 최초 비밀번호 화면은 아직 없으므로 계정 생성을 완료한 사용자를 등록 대상으로 선택해야 한다.

### Codex: 심사 배정 목록·회수·재배정

관리자 `judge-assignments`에 페이지형 GET을 추가했고, 배정별 `/revoke`, `/reassign` POST를 추가했다. 목록의 `allowedActions`만 버튼에 사용한다. 회수 요청은 `{expectedReviewState:'not_started',expectedReviewRevision,reason,actionId}`, 재배정은 여기에 새 `judgeId`, `blindCode`를 더한다. 진행 중 배정은 단독 회수할 수 없고 재배정만 가능하며, 제출 완료 배정은 둘 다 불가하다. 회수된 과거 점수·코멘트는 감사 목적으로 남지만 기존 심사위원 API에서는 즉시 사라진다. 재배정 결과의 새 배정은 새 블라인드 PDF 승인 전까지 기존과 같이 `BLINDED_FILE_NOT_READY`다. [상세](judging.md).

### Codex: Official Selection → Finalist 라운드와 본선 참가 확정

결과 공개를 migration 028의 두 라운드로 분리했다. `/results/publish`와 `/results/rounds/official_selection/publish`는 첫 발표이며 finalist 내부 결정도 이때는 official_selection으로만 노출한다. 이후 공개된 official_selection 건만 review PUT으로 official_selection/finalist 결정을 갱신할 수 있고, `/results/rounds/finalist/publish`에서 최종 승격을 공개한다. 각 요청은 현재 competitionRevision을 사용한다.

Finalist 공개 성공 시 `finalParticipation={state:'invited',revision:1,...,allowedActions:['respond_final_participation']}`가 실제 참가자 응답에 생긴다. 참가자는 `POST /api/v1/entries/{id}/final-participation`에 `{expectedRevision,response:'accept'|'decline',actionId}`를 보내고, accept는 confirmation_pending이 된다. 운영자는 `PUT /api/v1/admin/competitions/{competitionId}/entries/{id}/final-participation`으로 confirmed/declined를 기록한다. confirmed와 결제 성공은 별개이며 현재 orderId는 null이다. 기존 준비 중 버튼을 실제 호출 UI로 바꿀 때는 finalParticipation.allowedActions만 사용한다. [상세](result-publication.md).

### Codex: 인증서 발급과 참가자 조회

migration 029와 관리자 `POST /api/v1/admin/competitions/{competitionId}/certificates/issue`를 추가했다. `{entryIds,stage,actionId}`로 공개 결과 증거가 있는 1~100건을 예약하며 202/pending은 PDF 발급 완료가 아니다. 내부 작업자가 PDF를 private/versioned S3에 저장하고 DB 확정까지 마친 뒤에만 `GET /api/v1/certificates`, `GET /api/v1/entries/{id}/certificates`와 Entry의 `download_certificate`가 열린다. 다운로드는 `POST /api/v1/certificates/{id}/download` 빈 JSON으로 60초 링크를 받는다. 목록의 `allowedActions`만 버튼에 사용하고 URL을 저장하지 않는다. `listMyCertificates` live 어댑터는 `/certificates?limit=50`에 연결했다. 화면의 `href="#"` 다운로드 버튼 연결은 Claude 작업이다. [상세](certificates.md).

사용자 확인: 서버/호스팅·DB·저장소 계정 없음. 구성 제안 단계이며 유료 계정 생성·신청·배포는 하지 않았다. 실서비스처럼 저장/결제 완료를 표시하지 않는다.
