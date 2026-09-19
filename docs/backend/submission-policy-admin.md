# 관리자 제출 정책 등록·조회

GET/PUT `/api/v1/admin/competitions/{competitionId}/submission-policy`

2026-09-16. 참가 규정·개인정보·작품 이용허락 문서 및 국가별 보호자 기준을 저장하는 관리자 API다. 화면은 수정하지 않았으며 실제 운영 정책을 입력하지 않았다.

## 계약

공통 타입은 `src/contracts/submission-policy.ts`다. 기존 서버 SubmissionPolicySchema를 공통 계약으로 옮기고 재수출해 이전 호출과 검증 기준을 유지했다.

GET 응답 data는 competitionId, revision, policy다. 아직 설정하지 않았으면 policy=null이다. PUT body는 `{revision,policy}`이며 일부 수정이 아닌 전체 정책 교체다. 성공 응답은 새 revision과 저장한 policy다.

policy에는 enabled=true, version, guardianAgeBasis=submission_date_in_competition_timezone, guardianAgeByCountry(대문자 국가 코드→0~19 정수), documents가 있다. documents는 기존 ConsentDocumentSchema의 3~6개 문서이며 kind+locale 조합이 중복될 수 없다. marketing 동의는 허용하지 않는다. 실제 제출에 필요한 언어별 3종 문서의 완성 여부는 기존 readiness가 확인한다. 국가별 값의 법적 적합성은 자동 검증하지 않는다.

본문은 기존 JSON 요청 제한 128KiB를 따른다. 문서별 스키마의 최대 길이가 허용되더라도 전체 JSON이 128KiB를 넘으면 저장할 수 없다.

## 변경 제한·감사

전체 공모 운영자 gyca_competition_editors 권한과 실제 세션이 필요하다. PUT에는 동일 Origin이 필요하다. revision은 공모 정보 수정과 공유한다. 정책 저장 후 기존 공모 편집 화면도 최신 revision을 다시 읽어야 한다.

draft_enabled 또는 payment_enabled가 켜져 있거나 접수 데이터가 하나라도 존재하면 ENTRY_LOCKED 409다. 이미 받은 동의의 근거가 바뀌지 않도록 활성 공모의 정책 교체를 제한한다. 정책 저장은 접수·결제·공개 플래그를 바꾸지 않는다. enabled=true도 정책 형식의 활성 표시일 뿐 접수 오픈 명령이 아니다.

마이그레이션 016의 gyca_submission_policy_changes에 정책 원문·revision·담당자·시각을 같은 트랜잭션으로 기록한다. 감사 실패 시 정책 변경도 롤백하며 일반 이력 수정/삭제는 차단한다. 현재 정책만 GET으로 제공하고 이력 조회 API는 추가하지 않았다.

## 검증

권한·Origin·입력·없는 공모·미설정 조회·저장·revision 충돌·감사 불변성/실패 롤백·활성/접수 존재 시 변경 차단·오픈 플래그 유지 등을 확인했다. 기존 제출·DB 점검 포함 20개, 전체 타입 검사와 관련 ESLint 통과. 실제 운영 DB 마이그레이션·정책 확정·관리자 화면은 미실행이다.
