# 관리자 결제 정책 API

GET/PUT `/api/v1/admin/competitions/{competitionId}/payment-policy`

## 계약과 권한

공통 타입은 `src/contracts/payment-policy.ts`. GET data는 competitionId, revision, policy, routing이며 미설정 항목은 null이다. PUT은 `{revision,policy,routing}` 전체 교체이며 성공 시 새 revision을 반환한다. 공모 정보·제출 정책과 revision을 공유하므로 저장 후 다른 편집 화면도 새 값을 조회한다.

해당 공모의 gyca_payment_permissions viewer/operator는 조회할 수 있고 operator만 수정할 수 있다. 전체 공모 편집 권한만으로 결제 정책을 수정하지 못한다. operator 역할에 이번 설정 기능이 추가됐다. 실제 운영자는 해당 권한 부여 범위를 확인해야 한다.

- policy: version과 approvalBasis(provider_paid_at 또는 server_verified_at). 마감 전에 결제됐는지를 PG 승인 시각으로 판단할지, 서버 검증 시각으로 판단할지 명시한다.
- routing: version 및 최대 20개 routes. 경로별 id, enabled, provider, merchantAccount, liveMode, countries, currency=EUR, approvalReference, 한/영 label/refundNotice를 저장한다. 경로 id 중복은 거부한다.
- 가맹점 ID는 내부 관리자 응답에 포함된다. PG 비밀 키 필드는 없으며 입력하면 거부한다. 비밀 키는 서버 환경변수로만 관리한다.

## 저장과 실제 사용의 차이

경로 설정은 서비스 가입이나 PG 계약 확인을 수행하지 않는다. provider/liveMode 문자열을 저장해도 해당 공급자가 런타임에 구현·설정되지 않았다면 실제 결제 경로로 사용할 수 없다. 현재 Toss 테스트 연결과 EUR 지원 확인 조건을 유지하며 Stripe/PayPal 구현이나 실결제 지원을 추가한 것은 아니다.

정책 저장은 draft_enabled/payment_enabled/published를 변경하지 않는다. 경로의 enabled=true도 결제 오픈 명령이 아니다. 국가·마감 기준·환불 문구의 운영/법적 적합성은 별도 검토해야 한다. 금액과 일정은 기존 공모 정보 API에서 관리한다.

접수/결제 플래그가 활성화됐거나 접수 데이터가 존재하면 ENTRY_LOCKED 409로 교체를 막는다. revision 불일치는 REVISION_CONFLICT 409다. 저장과 마이그레이션 017의 감사 기록은 하나의 트랜잭션이며 감사 실패 시 함께 롤백한다. 감사의 일반 수정·삭제는 차단한다. 현재 정책 조회만 제공하고 감사 이력 조회는 후속 범위다.

PUT은 동일 Origin·실제 세션·JSON 128KiB 제한을 따른다. 응답은 private,no-store다. policy/routing의 개별 문자열 한도보다 전체 본문 제한이 먼저 적용될 수 있다.

## 검증 및 남은 사항

설정 API·기존 결제 경로·DB 점검 테스트 13개 통과. 권한 분리·공모 범위·Origin·미허용 필드·revision·접수 존재 시 차단·감사 불변/롤백·payment_enabled 유지 등을 확인했다. 실제 PG·운영 DB·화면 연결은 실행하지 않았다. 프런트 코드는 수정하지 않았으며 실제 정책 값도 입력하지 않았다.
