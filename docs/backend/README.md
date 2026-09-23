# GYCA 서버 구현 및 프런트엔드 협업

## 현재 단계

공통 타입, 접수 초안 API, 공개 공모 API, 업로드 세션·파일 검사, 제출 스냅샷·동의 증적, 주문·검증 이벤트·접수 확정 기반을 구현했다. 아래 문서에서 각 단계의 구현 범위와 제한을 확인한다. 실제 개발용 PostgreSQL·저장소·PG 연결은 아직 남아 있다.

결제창 시작 경계와 비활성 기본값은 [payment-checkout.md](payment-checkout.md)를 따른다.

최초 문서는 도메인 및 API 제안이며 전체 플랫폼 구현 완료를 뜻하지 않는다. 엔드포인트별 구현 여부는 각 구현 현황 문서를 기준으로 구분한다.

- 기존 기반: Next.js 16.3.1, React 19, Better Auth, PostgreSQL 연결 코드.
- 기존 접수 화면과 공모 데이터는 검토용 UI 및 샘플이다.
- 첫 출시: Leipzig 2027, 작품당 EUR 70, 표지 이미지와 최소 20쪽 단일 PDF, 동의, 접수, 결제, 결과, 인증서 다운로드.
- 클림트 빌라: 완료 프로젝트 아카이브. 신규 접수나 작품 구매 결제 대상이 아니다.
- 장기 확장: 다른 장르, 기관 단체접수, 대용량 미디어, 고급 폼 빌더.

## 문서

- [2026-09-19 회고 결정과 후속 5단계](retrospective-decisions-2026-09-19.md) — Claude의 계약 대기 해소, 보호자·프로필 검증 경로와 남은 외부 작업.
- [완료 프로젝트 아카이브](project-archive.md) — 출처·권리 근거 발행, 10종 섹션, 공개 프로젝트·Winners·Exhibitions API.
- [공모 카드 표시 정보](competition-presentation.md) — 접수 정책과 분리한 summary/category/city/cover 편집과 공개 카드 목록.
- [Claude 통합 인계](claude-handoff.md) — 이후 화면 연동 변경의 단일 진입 문서.
- [공모전 등록·수정·공개 API](competition-admin-implementation.md) — 주최 측 등록·공개와 접수 활성화 분리, 화면 미연결.
- [결제 경로의 주문 고정](routed-orders-implementation.md) — 선택 경로 검증·환불 안내 수락 증적·원자적 주문 생성.
- [국내·해외 결제 경로 안내 기반](payment-options-implementation.md) — 국가·통화·공급자별 후보 조회, 실제 선택·결제 시작 미연결.
- [관리자 결제 확인 API](payment-admin-implementation.md) — 공모전별 권한·중단 조회 재개·감사 이력, 관리자 화면 미연결.
- [환불 원장·관리자 API](refunds.md) — 부분/전체 환불 한도, 멱등 공급자 취소, 불명확 응답의 pending 유지와 참가자 주문 요약.
- [접수·결제 최초 오픈](launch-control.md) — 현재 revision의 외부 검증 증거와 전체 readiness를 통과한 뒤 두 게이트를 원자적으로 활성화.
- [관리자 접수 CSV 내보내기](entry-export.md) — 목록과 같은 필터, 개인정보 포함 범위, 수식 주입 방어, 1만 행 제한과 불변 감사.
- [관리자 운영 대시보드](admin-dashboard.md) — 계정·최신 참가국·공모별 접수/결제/심사/결과의 개인정보 없는 집계.
- [회원 탈퇴·개인정보 삭제 요청](privacy-requests.md) — 참가자 요청·철회, 운영 보관 검토와 실행 승인 전까지의 불변 증적.
- [공개 편집 콘텐츠 CMS](editorial-cms.md) — 공지·일정·FAQ·News·Press의 초안, 수정, 발행, 보관과 공개 조회.
- [결제 재확인 작업 구현](payment-recovery-implementation.md) — DB 복구 큐·내부 실행 경로 구현, 실제 스케줄러 미연결.
- [토스 승인·조회 어댑터 구현](toss-adapter-implementation.md) — 테스트 설정 경로 추가, 실제 토스 결제·라이브 미검증.
- [주문·결제 검증·접수 확정 구현](payment-api-implementation.md) — 공급자 기본 비활성, 실제 결제창·승인 API 미연결.
- [토스 해외결제 연동 검토](toss-payment-integration.md) — 우선 검토 대상, EUR 가맹 조건 확인 필요.
- [제출·동의 증적 API 구현](submission-api-implementation.md) — 정책 기본 비활성, 결제·접수 확정과 분리.
- [업로드 세션·파일 검사 구현](upload-api-implementation.md) — 저장소 공급자는 미연결, 실업로드는 비활성.
- [공개 공모 API 구현](competition-api-implementation.md) — 공모 상태·준비 여부와 초안 허용 판정 공유.
- [프런트엔드 검토 결정 v0.2](frontend-resolution.md) — Claude A~E 검토에 대한 최신 답변. 기존 초안과 충돌하면 이 문서 우선.
- [도메인과 운영 정책](domain-and-policy.md)
- [프런트엔드 API 초안](api-contract.md)

## 담당 범위 제안

| 담당 | 파일 및 책임 |
| --- | --- |
| Codex | `docs/backend/`, 향후 `src/contracts/`, `src/server/`, 접수·결제·업로드 API, 도메인 테스트, DB 마이그레이션 |
| Claude | 공개·접수·마이페이지·운영 화면, `src/components/`, 화면용 mock 및 API 어댑터 |
| 사전 조율 | `src/lib/auth.ts`, 인증 라우트, `package.json`, lockfile, Next 설정, 언어별 라우트, 전역 스타일 |

폴더는 담당 범위를 제안하기 위한 것이며, 아직 생성되지 않은 폴더도 포함한다. 기존 작업은 덮어쓰지 않는다. 인증 파일은 서버 측 변경이 필요할 때 Codex가 담당한다. 공통 타입 변경은 문서와 화면 영향을 같이 기록한다.

Claude는 서버 내부 모듈을 브라우저 컴포넌트에서 import하지 않는다. API를 연결하기 전까지 mock임을 개발 과정에서 명시하고, 실제 저장·결제 완료로 보고하지 않는다.

## 다음 구현 순서

1. Claude의 필드·화면 상태 요구와 API 초안을 대조하고 공통 타입을 확정한다.
2. DB 마이그레이션과 접수 임시저장 API를 구현한다. 본인 접근 및 동시 수정 충돌을 검증한다.
3. 비공개 파일 저장·직접 업로드·서버 파일 검증을 연결한다.
4. 제출 스냅샷 및 동의 증적을 저장한다.
5. 선정된 PG의 테스트 환경에서 주문·결제 확인·웹훅·재확인 처리를 구현한다.
6. 마이페이지·관리자·심사·인증서 접근을 연결한다.
7. 마감 경계, 지연 승인, 중복 요청, 장애 복구를 검증한다.

결과 공개 및 인증서 다운로드는 첫 출시 범위에 포함한다. 인증서 자동 생성은 업로드 방식과 비교해 별도로 결정한다. 본선 참가비는 출품비와 별도 주문 유형으로 확장한다.

## 외부 설정이 필요한 시점

- DB 통합 검증: 테스트용 PostgreSQL 연결 환경. 비밀 값은 채팅이나 문서에 기록하지 않는다.
- 업로드 통합: 저장소 공급자·리전·용량 정책·접근 권한.
- PG 통합: 사업자 소재국·판매 주체·청구 통화·정산 통화·테스트 가맹점.
- 실서비스 접수 개시: 마감·환불·동의·개인정보 보관 정책 확정.

정해지지 않은 부분 때문에 독립적인 설계를 중단하지 않되, 운영 정책을 추측해 실서비스에 적용하지 않는다.

## Claude에 전달할 메시지

> 제출 API와 공통 타입을 추가했다. `src/contracts/submissions.ts`와 `docs/backend/submission-api-implementation.md`의 화면 연결 규칙을 참고해 줘. 최종 단계는 readiness의 문서·policyToken·allowedActions를 사용하고, 제출 성공은 `submitted`로 표시해 줘. 실 DB·저장소·PG 연결 전이라 실제 접수 확정이나 결제 성공을 표시하면 안 돼. 디자인 복구 파일은 수정하지 않았어.
