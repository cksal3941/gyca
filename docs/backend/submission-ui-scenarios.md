# Claude 접수 화면 연결용 두 시나리오

2026-09-16. [예제 모듈](examples/submission-scenarios.mjs)은 Codex가 제공하는 별도 전달 자료다. Claude 담당 src/lib/mock, src/lib/api, 화면은 수정하지 않았다. 이 모듈을 검토해 mock으로 매핑하고 실제 API 응답과 동일한 계약 파서를 사용한다. 운영 초기 데이터로 넣거나 실제 동의문으로 사용하지 않는다.

## 시나리오

| 항목 | first-release | full-preview |
| --- | --- | --- |
| 입력 | 이름·생년월일·거주국·보호자 이름/이메일·영문 제목/소개·부문 | FORM_FIELD_PATHS의 모든 필드와 예시 값 |
| 업로드 규격 | 표지 1개, 책 PDF 1개 | ASSET_PURPOSES 전체: 표지·책 PDF·저작권 선언·보호자 동의서·출판사 허가서 |
| 동의 | 필수 3종 한/영 문서 | 같은 3종 한/영 문서 |
| 선택 동의 | 빈 배열 | 빈 배열 |
| 실제 접수·결제 | 비활성 | 비활성 |

full-preview는 현 계약의 전체 항목을 보여주는 시연이다. 영상·음원·대용량 분할 업로드 등 계약 밖 기능을 포함한 전체 사업 구현을 의미하지 않는다. 추가 증빙 업로드는 선택 예제이며 국가·출판 상태별 제출 의무를 확정하지 않는다. 보호자 동의서 파일이 있다는 이유로 guardian verification을 verified로 바꾸지 않는다.

## 데이터 구조와 렌더링

- submissionScenarios 배열에서 id로 선택한다. demoOnly는 예제 메타데이터이며 API 필드가 아니다.
- competition은 CompetitionSchema, competition.formSpec은 FormSpecSchema로 검증한다.
- draft는 UpdateEntryRequestSchema와 같은 구조다. revision=1은 시연 값이다. 실제 저장에서는 서버가 반환한 현재 revision을 쓴다.
- documents는 ConsentDocumentSchema를 따르는 한/영 6개 문서다. 화면 언어에 맞춰 3개만 표시한다. 문구·버전은 시연용이며 실제 법적 동의문으로 쓰지 않는다.
- optionalConsents=[]이면 제목·체크박스·빈 공간을 렌더링하지 않는다. 추후 마케팅 수신 시연을 별도로 넣더라도 이 데이터를 실제 제출 consents에 합치지 않는다.
- fields의 path를 기존 필드 컴포넌트·번역 키에 매핑한다. category 선택지는 categories에서, publicationStatus는 현재 draft 계약의 published/unpublished에서 가져온다. FORM_FIELD_PATHS에 없는 입력은 임의로 서버에 보내지 않는다.
- 업로드 항목은 규격만 제공한다. 실제 파일·저장소 객체·검증 완료 자산이 포함된 것이 아니다. maxBytes는 화면 검토용 상한 예시이며, 공모 운영 정책은 별도로 확정해야 한다. 서버 검사 상한 64MiB를 넘기지 않았다.

## 실제 접수 연결 시

이 예제는 날짜·연령그룹·기준일이 미확정이라 allowedActions=[]와 readiness=false다. 공개 Apply CTA를 켜지 않는다. 별도 개발용 화면에서 시나리오를 열어 입력 구성을 검토한다. 실제 접수 가능 시연이 필요하면 완전한 개발 정책을 별도 fixture로 만들고 운영 설정과 구분한다.

동의문·버전·policyToken·제출 가능 여부는 실제 submission-readiness 응답으로 교체한다. 예제에는 제출용 policyToken을 제공하지 않는다. requiredOnSubmit만으로 모든 서버 필수 조건이 표현되지는 않는다. 영문 제목/소개·부문·생년월일·거주국의 서버 필수 검사와 보호자 조건, 업로드 검사, 마감 검사를 함께 따른다. 제출 버튼은 allowedActions에 submit이 있을 때만 허용한다.

## 검증

예제 계약 테스트에서 두 competition/form/draft 검증, 전체 필드·업로드 항목 포함, 한/영 3종 동의, 현재 계약의 marketing 거부, 실제 접수 액션 비활성, 업로드 상한을 확인했다. 관련 ESLint 통과. 화면 렌더링과 실제 서버 접수 성공을 검증한 것은 아니다. tests/submission-scenarios.test.mjs는 전체 verify-backend 실행에 자동 포함된다.
