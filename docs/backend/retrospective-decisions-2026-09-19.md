# Claude 회고 검토 결과와 후속 작업

2026-09-19, Codex. 검토 대상: `docs/claude-retrospective-2026-09-19.md`. 사용자는 일반적인 국제 공모전 운영을 기준으로 기술·정책 구조를 결정하고 진행하도록 위임했다. 이 문서의 구조 결정에는 추가 대표 확인을 기다리지 않는다. 외부 계정 생성·계약 체결·권리 사실 확인까지 완료된 것으로 간주하지는 않는다.

## 1. 이번에 해결한 백엔드 계약

| 회고 항목 | 결정과 현재 상태 |
| --- | --- |
| 아카이브·Winners·Exhibitions | 완료 프로젝트 편집 CMS + 공개 API 구현. 공개용 자료만 수동 등록하고 출처·권리 근거로 발행. [상세](project-archive.md) |
| contests 카드 필드 | 별도 presentation API 구현. summary/category/city/cover 제공, 기간은 실제 일정에서 표시. [상세](competition-presentation.md) |
| 프로필 계약 부재 | 새 프로필 DB/API 불필요. `/settings`의 `authClient.updateUser`를 재사용. 접수 참가자의 실명·영문명은 기존 초안 계약에 저장하며 계정 표시 이름과 구분 |
| 보호자 테스트 불가 | API에 토큰을 노출할 필요 없음. 기존 주입 가능한 mailer의 발송 내용을 테스트에서 받아 preview→accept→운영자 검증까지 확인 가능 |
| 동의 구조 미결 | 기존 3종 문서·버전·locale·policyToken·동결 snapshot 계약 유지. 중복 계약 신설 불필요 |

새 migration은 038·039이며 공식 로더에 등록했다. 임시 PGlite 검증에서 적용했으며 사용자의 로컬 운영 DB나 외부 DB에는 아직 적용하지 않았다.

## 2. 동의·보호자·보관 정책 구조

### 동의

기존 `participation_rules`, `privacy`, `work_license`를 각각 표시·수락한다. EN/KO 버전과 제출 시점의 문서 내용을 보관한다. 작품 저작권은 참가자에게 두고, 전시·출판·공연·공모 홍보에 필요한 비독점 이용 범위, 매체, 기간, 크레딧과 제3자 제공 범위를 work_license에 명시하는 구조를 채택한다. 수상 여부에 따라 추가 이용 범위가 생기면 그 근거도 별도로 확인한다.

공모전의 작품 이용허락과 참가자에게 광고성 연락을 보내는 선택 동의는 다르다. 선택 마케팅은 현재 계약에 추가하지 않는다. 첫 출시 UI는 선택 동의 영역을 데이터로 받을 준비만 하고 빈 상태로 두며, 필수 작품 이용허락을 선택 광고 수신으로 대체하지 않는다.

국제 공모 사례로 [Sony Youth 규정](https://www.worldphoto.org/sony-world-photography-awards/youth)과 [Scholastic 비독점 이용허락 설명](https://cms.artandwriting.org/faq/why-do-i-grant-the-alliance-a-non-exclusive-license-to-use-my-work-when-i-enter/)을 참고했다. 해당 공모전의 기간·국가별 조항을 GYCA에 그대로 적용한 것은 아니다.

### 보호자

첫 출시 기본 흐름은 기존 **이메일 링크 수락 → 운영자 확인 근거 기록 → verified**로 정한다. 이메일 수락(consented)만으로 신원 검증 완료나 접수 완료라고 표시하지 않는다. `GYCA_GUARDIAN_CONSENT_ENABLED`는 정책과 HTTPS origin·메일 전달 경로가 준비된 환경에서만 켠다.

`tests/submission-api.test.mjs`의 guardian 시나리오는 주입한 mailer가 받은 메시지에서 링크를 읽어 검증한다. 따라서 회고의 “응답에 토큰이 없어서 로컬 검증 불가”는 수정해야 한다. 일반 API 토큰 반환이나 공개 debug endpoint는 추가하지 않는다. 브라우저 E2E에는 격리된 로컬 메일 수신함과 HTTPS origin을 준비한다. 테스트용 수신함을 운영 환경에서 켜지 않는다.

국가별 연령은 기존 정책 표로 설정한다. EU 전체를 무조건 16세로 고정하지 않는다. 동의에 근거한 아동 대상 서비스의 조건과 회원국 차이는 [EU 집행위원회 안내](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en)를 기준으로 검토한다. 보호자 판정과 공모전 연령그룹 기준일은 기존 별도 필드를 유지한다.

### 보관

원본 작품, 공개 허락된 전시 사본, 동의·결제 증거를 서로 다른 목적의 기록으로 관리한다. 기존 retention policy와 작업자를 재사용하며 아카이브 등록이 참가 원본의 영구 보관 근거가 되지 않게 한다. 삭제 요청의 `approved_for_execution`도 실제 삭제 완료와 구분한다.

‘국제 공모전 공통 법정 보관 일수’는 없다. 목적에 필요한 기간만 보관하고 검토·삭제 시점을 설정한다는 [EU 집행위원회 원칙](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)을 따른다. 현재 사업자 관할과 정산·분쟁 증거 의무가 확인되지 않은 상태에서 숫자를 법정 최소값으로 만들어 넣거나 파기 작업을 활성화하지 않았다. **구조 구현은 완료됐고, 운영용 보관 일수 입력과 실제 파기 검증은 남아 있다.**

## 3. Claude 작업 지시 — 아래 순서로 진행

### 1단계: 공개 카드 연결

- `src/contracts/competition-presentation.ts`를 import하는 `src/lib/api` 어댑터 추가.
- contests 목록에 `/api/v1/content/competition-cards`를 연결. 기존 디자인 유지, 부가 정보 null 처리, 서버 Apply 액션 유지.
- 관리자 공모 편집에 presentation GET/PUT을 연결. 운영 정책 저장과 별도 저장 버튼·오류 상태 사용.
- 확인: 표시 정보 없는 기존 공모, 승인 전 도시 비노출, 저장 후 재조회, 다른 운영자의 revision 충돌, 접수 불가 공모의 CTA.

### 2단계: 완료 프로젝트 CMS와 공개 아카이브

- `project-archive.ts` 계약을 사용한 관리자 목록·초안·편집·발행·보관 어댑터/화면 구현.
- 기존 Klimt Archive 레이아웃에 공개 detail을 연결. `/winners`, `/exhibitions`는 프로젝트 단위 컬렉션 계약에 맞춰 연결.
- ready/pending을 판별하고, public pending에는 gallery 등 payload가 없음을 타입으로 처리. 빈 목록·404·통신 오류·재시도 UI 구현.
- **발행본 수정은 즉시 비공개**, archived는 복구 불가라는 서버 동작을 저장/보관 전에 표시.
- 공개 근거 입력은 실제 내부 자료 참조를 받는다. 개발 예시는 격리된 fixture에서만 사용한다.
- 확인: draft 비노출→발행→공개→수정 후 비공개→재발행→보관 후 404. pending 내부 자료가 네트워크 응답에도 없는지 확인.

### 3단계: 보호자·프로필 마무리

- 기존 guardian preview/accept 계약으로 보호자 링크 페이지와 참가자 요청·재요청 상태 연결.
- 로컬 HTTPS와 테스트 메일 수신 방식 또는 주입형 테스트 harness를 구성. 토큰은 발송 메시지에서만 가져온다.
- 확인: 만료·재발송으로 무효화된 링크, 정책/접수 revision 변경, consented와 verified 구분, 운영자 확인 후 readiness.
- 마이페이지 개인정보 탭의 일반 계정 편집은 `/settings`로 연결하거나 기존 Better Auth 호출을 재사용. 접수 snapshot에 계정 변경을 소급하지 않는다.

### 4단계: 남은 관리자 변경 작업

- 지연 결제 인정·재큐·환불, 결과 발표·인증서 발급의 기존 계약과 allowedActions를 사용해 화면을 완성.
- 개발 DB에 격리된 접수·주문·심사 fixture를 준비하고 테스트 공급자·저장소로 성공/거절/중복/불명확 응답을 검증.
- 외부 계정이 없다는 이유로 화면 구현과 로컬 검증까지 미루지 않는다. 테스트에서 운영 결제를 활성화하거나 샘플을 실제 기록으로 공개하지 않는다.
- ‘엔드포인트 도달’과 ‘요청 성공→영속 상태 변경→재조회 확인’을 별도 검증 등급으로 기록한다.

### 5단계: 스테이징·실접수 검증

- 실제 사업자와 정산 통화에 맞는 PG 경로, DB·공개/비공개 저장소·메일 계정을 연결.
- migration 038·039 포함 적용, 메일·업로드·결제 승인·환불·복구 스케줄러·백업 복원 검증.
- 마감 직전 업로드·동시 결제, 승인 지연/콜백 중복, 결제 유예 이후 처리를 실제 구성에서 확인.
- 승인된 자료/정책과 검증 근거를 저장하고 launch-readiness가 통과한 뒤 기존 오픈 API 사용. 플래그나 DB 직접 수정으로 통과 처리하지 않는다.

각 단계 결과는 `docs/claude-integration-progress.md`에 파일·실행 명령·확인 시나리오·제한을 기록한다. 이 문서와 `docs/backend/claude-handoff.md`가 최신 진입점이다. 과거의 ‘계약 대기’ 문구보다 이번 계약을 우선한다.

## 4. 남은 외부 사항과 검증 결과

실제 사업자/PG 계정·통화 적합성, 클라우드·메일 계정, 전시 승인·사진·판매/인터뷰/인증서 원자료와 이용 근거는 현재 코드 작업으로 확보되지 않았다. 제출 마감·요금·지원 국가·운영 문구도 실제 공모 공고와 일치하는 값이 필요하다. 기술적 기본 구조를 정할 권한과 이 사실들을 확인한 것은 구분한다.

이번 검증: `node scripts/verify-backend.mjs` **287개 통과, 실패/건너뜀 0**, 프로젝트 타입 검사·백엔드 린트 통과. `pnpm.cmd build --webpack` 성공. 새 API의 PGlite/로컬 HTTP 검증이며 브라우저 UI 배선, 운영 PostgreSQL, S3, 메일 전달, PG 실승인, 마감 부하 검증까지 완료한 것은 아니다. 회고의 ‘80%’ 수치 대신 위 단계별 완료 조건으로 진행률을 관리한다.
