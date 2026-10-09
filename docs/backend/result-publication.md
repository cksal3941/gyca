# 단계별 심사 결과 공개와 본선 참가 확정

2026-09-19. 내부 심사 결정과 참가자 공개 결과를 분리하고, Official Selection과 Finalist를 서로 다른 불변 공개 라운드로 기록한다. 본선 초대·참가자 의사·운영 확정은 결과와 별도 상태로 관리한다.

## API

- GET/PUT `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/review`
- POST `/api/v1/admin/competitions/{competitionId}/results/publish`
- POST `/api/v1/admin/competitions/{competitionId}/results/rounds/{official_selection|finalist}/publish`
- POST `/api/v1/entries/{entryId}/final-participation`
- PUT `/api/v1/admin/competitions/{competitionId}/entries/{entryId}/final-participation`

심사 PUT은 `expectedRevision`, `reviewStatus`, `decision`을 받는다. `completed`일 때만 `official_selection`, `finalist`, `not_selected` 중 하나를 결정할 수 있다. 변경 이력은 행위자·revision·시각과 함께 불변 기록으로 남는다. 권한이 있는 운영자만 접수 확정(`received`) 건을 변경할 수 있으며 접수 마감 전이나 결과 공개 후에는 변경할 수 없다.

참가자 응답에는 내부 decision을 내리지 않는다. 공개 전에는 `publishedResult=null`을 유지하고 reviewStatus만 제공한다.

## 단계별 결과 공개

공개 요청은 공모 revision을 검사한다. 다음 조건을 모두 만족해야 한다.

- 접수 및 설정된 결제 마감이 지났다.
- 첫 라운드는 아직 결과 공개 전이며, 두 번째 라운드는 첫 라운드가 공개된 result 단계다. archived에서는 실행하지 않는다.
- `submitted` 상태로 결제 확인이 끝나지 않은 건이 없다.
- 접수 확정 건이 한 건 이상이며 모든 건의 심사 상태와 결정이 완료됐다.
- 공모별 보관 정책이 존재한다.

첫 라운드는 모든 접수 확정 건을 `official_selection` 또는 `not_selected`로만 공개한다. 내부 결정이 finalist여도 이 단계에서는 official_selection으로만 보인다. 기존 `/results/publish`는 첫 라운드 별칭이다. 첫 라운드 뒤에는 공개된 official_selection 건만 내부 결정을 official_selection/finalist 사이에서 갱신할 수 있다.

두 번째 라운드는 첫 라운드 official_selection 대상만 처리하며, 이때 finalist가 처음 공개된다. 각 라운드는 competition revision을 하나씩 증가시키고 같은 원래 revision 재요청은 저장된 결과를 반환한다. 순서를 건너뛰거나 공개 결과를 탈락으로 되돌릴 수 없다.

첫 라운드에서는 not_selected 파일만 `unselectedSubmissionAssets` 기간으로 파기 예약하고, 두 번째 라운드에서는 official_selection/finalist 파일을 `selectedSubmissionAssets` 기간으로 예약한다. 라운드 기록·결과 투영·파기 예약 중 하나라도 실패하면 전체가 원복된다.

동일한 원래 competitionRevision 재요청은 저장된 공개 결과를 반환한다. 다른 revision으로 이미 공개된 결과를 덮어쓸 수 없다.

## 본선 참가 확정

Finalist 라운드 성공 시 해당 접수에만 `invited` 상태를 생성한다. 이 상태에서만 `finalParticipation.allowedActions=['respond_final_participation']`을 제공한다. 참가자는 expectedRevision과 actionId를 포함해 accept 또는 decline을 제출한다. accept는 `confirmation_pending`이며 즉시 confirmed가 아니다. 운영자는 자격·서류 확인 뒤 별도 API로 confirmed 또는 declined를 기록한다. 모든 변화는 사유·행위자·revision과 함께 불변 이력에 저장한다.

`confirmed`는 결제 성공과 같은 뜻이 아니다. 현재 본선 참가비 주문은 생성하지 않으며 `orderId`는 null이다. 전액 지원·유료 본선 참가 정책과 금액이 확정된 뒤 별도 주문 종류로 연결한다. 프런트는 Claude 인계 계약이 반영되기 전까지 기존 준비 중 버튼을 유지한다.

실제 AWS·스케줄러가 검증되지 않았으므로 보관 준비 상태는 계속 `unverified`다.
