# src/lib/mock — 개발용 mock (실제 API 아님)

이 폴더의 데이터는 **개발/화면 확인용 mock**이다. 실제 저장·결제·접수 완료를 의미하지 않는다.
UI에서 "실제 연결됨"으로 표기하지 않는다.

## 현재 상태 (어댑터 연결 완료)

- `fixtures.ts` — **raw(미검증) 데이터**. `@/contracts` 형태에 맞춰져 있고 도메인 타입을
  여기서 선언하지 않는다. 공모마다 `id`(+`slug`)·`blockingReasons`, 작품 필드는
  `englishTitle`/`englishDescription`, `guidelines=null`이면 `view_guidelines` 없음,
  필수 정책 미정이면 `readiness=false`.
- `src/lib/api/index.ts` — **어댑터**. `@/contracts`의 Zod 스키마로 **safeParse**해서
  branded/typed 값으로 반환한다. 파싱 실패는 데이터로 전달하지 않고 `error` 상태가 된다.
  문자열을 branded id로 타입 단언하지 않는다.
- 각 호출은 UI용 `RequestState`(loading/success/empty/error+retryable)로 감싼다.
- 전 fixture는 스키마 superRefine(readiness·start_entry·received·exhibition·asset 등)을
  safeParse로 통과함을 확인했다.

## 재현하는 상태 (v2 §9)

- 공모: `open-ready`(start_entry 허용) / `open-not-ready`(POLICY_NOT_CONFIGURED) /
  `upcoming` / `archived`.
- 접수: draft / 필수누락+CONSENT+GUARDIAN / PDF_TOO_FEW_PAGES(asset) /
  submitted+pending / submitted+succeeded+RECEIPT_PENDING / received /
  official_selection / finalist(finalParticipation not_available).
- My GYCA: 주문·인증서의 `some`/`empty`/`error` 상태.
- `getCompetitionSync`는 서버 컴포넌트에서, 목록 함수는 `delayMs`로 로딩 재현 가능.

## 아직 실제 API 아님

네트워크·저장·결제 없음. 화면에서 "실제 연결됨"으로 표기하지 않는다. 실제 서버 연결은
후속(Codex `/api/v1/*`)에서 이 어댑터의 mock 구현만 교체한다.

## 미확정(준비 중) 정책

마감 정확 시각/유예(Q1), 보호자 확인 방식(Q2), 이름 필수 여부·나이 기준일(Q6),
`maxBytes`, 전시 공식명/장소 승인은 **운영 확정 전**이다. 화면은 이를 "준비 중/미정"으로
표현하고, mock 값을 실운영 값으로 사용하지 않는다.
